const express = require('express');
const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand  } = require('@aws-sdk/client-s3');
const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { CognitoIdentityClient, GetIdCommand, GetCredentialsForIdentityCommand } = require('@aws-sdk/client-cognito-identity');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const bodyParser = require('body-parser');
const config = require('./config/config');  // Importa la configuración

const app = express();
app.use(express.static('public'));
app.use(bodyParser.json());

const client = jwksClient({
  jwksUri: config.jwksUri,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

function verifyToken(req, res, next) {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  jwt.verify(token, getKey, {
    audience: config.clientId,
    issuer: `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`,
  }, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Token is not valid' });
    }
    req.user = decoded;
    req.token = token;
    next();
  });
}

// Obtener credenciales temporales de AWS usando Cognito Identity Pool
async function getS3ClientFromToken(token) {
  const cognitoIdentity = new CognitoIdentityClient({ region: config.region });

  const loginData = {
    [`cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`]: token,
  };

  const identityParams = {
    IdentityPoolId: config.identityPoolId,
    Logins: loginData,
  };

  try {
    const identityData = await cognitoIdentity.send(new GetIdCommand(identityParams));

    const credentials = await cognitoIdentity.send(
      new GetCredentialsForIdentityCommand({
        IdentityId: identityData.IdentityId,
        Logins: loginData,
      })
    );

    const s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: credentials.Credentials.AccessKeyId,
        secretAccessKey: credentials.Credentials.SecretKey,
        sessionToken: credentials.Credentials.SessionToken,
      },
    });

    return s3Client;
  } catch (err) {
    console.error("Error getting credentials from Identity Pool:", err);
    throw err;
  }
}

// Método de login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const client = new CognitoIdentityProviderClient({ region: config.region });

  const params = {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: config.clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  };

  try {
    const command = new InitiateAuthCommand(params);
    const response = await client.send(command);

    const idToken = response.AuthenticationResult.IdToken;
    res.json({ token: idToken });
  } catch (error) {
    console.error('Authentication failed:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Listar el contenido de una carpeta en el bucket S3
app.get('/list', verifyToken, async (req, res) => {
  const { prefix } = req.query;

  try {
    const s3Client = await getS3ClientFromToken(req.token);
    const params = {
      Bucket: config.bucketName,
      Prefix: prefix,
      Delimiter: '/',
    };

    const data = await s3Client.send(new ListObjectsV2Command(params));
    res.json(data);
  } catch (err) {
    console.error('Error listing objects:', err);
    res.status(500).json({ error: 'Failed to list objects' });
  }
});

// Obtener el contenido de un archivo JSON en S3
app.get('/file', verifyToken, async (req, res) => {
  const { key } = req.query;

  try {
    const s3Client = await getS3ClientFromToken(req.token);
    const params = {
      Bucket: config.bucketName,
      Key: key,
    };

    const data = await s3Client.send(new GetObjectCommand(params));
    const jsonContent = await streamToString(data.Body);
    res.json(JSON.parse(jsonContent));
  } catch (err) {
    console.error('Error getting object:', err);
    res.status(500).json({ error: 'Failed to get object' });
  }
});

// Guardar el contenido de un archivo JSON en S3
app.post('/file', verifyToken, async (req, res) => {
  const { key, content } = req.body;

  try {
    const s3Client = await getS3ClientFromToken(req.token);
    const params = {
      Bucket: config.bucketName,
      Key: key,
      Body: JSON.stringify(content, null, 2),
      ContentType: 'application/json',
    };

    await s3Client.send(new PutObjectCommand(params));
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving object:', err);
    res.status(500).json({ error: 'Failed to save object' });
  }
});

app.delete('/file', verifyToken, async (req, res) => {
  const { key } = req.body;

  try {
    const s3Client = await getS3ClientFromToken(req.token);
    const params = {
      Bucket: config.bucketName,
      Key: key,
    };

    await s3Client.send(new DeleteObjectCommand(params));
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting object:', err);
    res.status(500).json({ error: 'Failed to delete object' });
  }
});

// Utilidad para convertir el stream a string
async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (chunk) => chunks.push(chunk));
    readableStream.on('error', reject);
    readableStream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

app.listen(3001, () => {
  console.log('Server running on http://localhost:8082');
});
