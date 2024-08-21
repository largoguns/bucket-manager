require('dotenv').config();
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const bucketName = process.env.BUCKET_NAME;

const streamToString = async (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });
  });
};

exports.handler = async (event) => {
  const { httpMethod, path, queryStringParameters } = event;

  // Construir la clave de S3
  let s3Key = `${path.slice(1)}`;

  if (queryStringParameters) {
    const queryPath = Object.entries(queryStringParameters)
      .map(([key, value]) => `${key}__${value}`)
      .join('/');
    s3Key += `/${queryPath}`;
  }

  s3Key += `/${httpMethod}/response.json`;

  const params = {
    Bucket: bucketName,
    Key: s3Key,
  };

  try {
    const data = await s3Client.send(new GetObjectCommand(params));
    const body = await streamToString(data.Body);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    };
  } catch (err) {
    console.error("Error reading S3 object:", err);
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'Not Found' }),
    };
  }
};


// Solo para pruebas locales
if (require.main === module) {
  const event = require('../mocks/testmock/GET/event.json'); // Carga el evento de prueba
  exports.handler(event).then(response => {
    console.log('Response:', response);
  }).catch(error => {
    console.error('Error:', error);
  });
}
