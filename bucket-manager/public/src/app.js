document.addEventListener('DOMContentLoaded', function() {
    // Configuración de JSONEditor para la edición de archivos existentes
    const container = document.getElementById("json-editor");
    const options = {
        mode: 'code',
        onError: function (err) {
            alert(err.toString());
        }
    };
    const editor = new JSONEditor(container, options);

    // Configuración de JSONEditor para el formulario de creación
    const createEditorContainer = document.getElementById("create-json-editor");
    const createEditor = new JSONEditor(createEditorContainer, options);

    const fileExplorer = document.getElementById('file-explorer');
    const fileService = document.getElementById('file-service');
    const fileQueryParams = document.getElementById('file-query-params');
    const fileMethod = document.getElementById('file-method');
    const fileApp = document.getElementById('file-app');
    const saveButton = document.getElementById('save-button');
    const cancelButton = document.getElementById('cancel-button');
    const deleteButton = document.getElementById('delete-button');

    const showCreateFormButton = document.getElementById('show-create-form');
    const createFormContainer = document.getElementById('create-form-container');
    const createForm = document.getElementById('create-form');
    const fileDetailsEditor = document.getElementById('file-details-editor');
    const cancelCreateButton = document.getElementById('cancel-create');

    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    let currentFileKey = ''; // Para almacenar la clave del archivo actual

    function showLogin() {
        loginOverlay.style.display = 'flex';
    }

    function hideLogin() {
        loginOverlay.style.display = 'none';
    }

    // Comprobar si el token existe en sessionStorage
    const token = sessionStorage.getItem('idToken');
    if (!token) {
        showLogin();
    } else {
        fileExplorer.innerHTML = "";
        //loadFileExplorer(); // Cargar el explorador de archivos si ya estamos logados
    }

    // Manejar el formulario de login
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                sessionStorage.setItem('idToken', data.token);
                hideLogin();
                fileExplorer.innerHTML = "";
                document.getElementById('username').value = "";
                document.getElementById('password').value = "";
                loadFileExplorer();
            } else {
                loginError.textContent = 'Login failed. Please try again.';
            }
        } catch (error) {
            loginError.textContent = 'An error occurred. Please try again.';
            console.error('Login error:', error);
        }
    });

    // Cargar y visualizar el árbol de archivos
    async function loadFileExplorer(prefix = '', parentElement = null) {
        
        try {           

            const response = await fetch(`/list?prefix=${prefix}`, {
                headers: { Authorization: sessionStorage.getItem('idToken') }
            });

            if (response.status === 401) {
                sessionStorage.removeItem('idToken');
                showLogin();
                return;
            }

            const data = await response.json();

            const ul = document.createElement('ul');
            ul.classList.add('file-list');

            // Cargar directorios
            if (data.CommonPrefixes) {
                data.CommonPrefixes.forEach(dir => {
                    const folderName = extractFolderName(prefix, dir.Prefix);
                    const li = createTreeNode(folderName, dir.Prefix, 'folder');
                    li.addEventListener('click', function(e) {
                        e.stopPropagation(); // Prevenir la propagación para que no se active la navegación de archivo
                        toggleFolder(li);
                    });
                    ul.appendChild(li);
                });
            }

            // Cargar archivos
            if (data.Contents) {
                data.Contents.forEach(file => {
                    if (file.Key !== prefix) {  // Evitar incluir la carpeta en sí misma
                        const fileName = extractFileName(prefix, file.Key);
                        const li = createTreeNode(fileName, file.Key, 'file');
                        li.addEventListener('click', function(e) {
                            e.stopPropagation(); // Prevenir la propagación para que no se active la navegación de carpeta
                            loadFileDetails(file.Key);
                        });
                        ul.appendChild(li);
                    }
                });
            }

            if (parentElement) {
                parentElement.appendChild(ul);
            } else {
                fileExplorer.appendChild(ul);
            }
        } catch (error) {
            console.error('Failed to load file explorer:', error);
        }
    }

    function extractFolderName(prefix, fullPath) {
        const withoutPrefix = fullPath.replace(prefix, '');
        const folderName = withoutPrefix.split('/').filter(Boolean)[0];
        if (folderName.includes('__')) {
            const [key, value] = folderName.split('__');
            return prefix === '' ? `?${key}=${value}` : `&${key}=${value}`;
        }
        return folderName;
    }

    function extractFileName(prefix, fullPath) {
        return fullPath.replace(prefix, ''); // Solo extrae la parte del archivo sin el prefijo
    }

    function createTreeNode(name, path, type) {
        const li = document.createElement('li');
        li.classList.add(type);
        li.dataset.path = path;
        li.dataset.type = type;
        const shortenedName = name.length > 20 ? name.slice(0, 20) + '...' : name;
        li.textContent = shortenedName;
        li.title = name;
        return li;
    }

    function toggleFolder(folderElement) {
        const path = folderElement.dataset.path;
        const isExpanded = folderElement.classList.contains('expanded');

        if (isExpanded) {
            folderElement.classList.remove('expanded');
            const nestedList = folderElement.querySelector('ul');
            if (nestedList) nestedList.remove();
        } else {
            folderElement.classList.add('expanded');
            loadFileExplorer(path, folderElement);
        }
    }

    async function loadFileDetails(fileKey) {
        currentFileKey = fileKey;  // Guardar la clave actual del archivo
        const response = await fetch(`/file?key=${fileKey}`, {
            headers: { Authorization: sessionStorage.getItem('idToken') }
        });

        if (response.status === 401) {
            sessionStorage.removeItem('idToken');
            showLogin();
            return;
        }

        if (response.ok) {
            const data = await response.json();
            editor.set(data); // Cargar datos en el editor JSON

            // Extraer y mostrar detalles
            const pathSegments = fileKey.split('/');
            fileApp.textContent = pathSegments[0]; // La aplicación es siempre el primer segmento
            
            // El Method siempre es el segmento justo antes de "response.json"
            fileMethod.textContent = pathSegments[pathSegments.length - 2]; 
            
            // El Service es todo lo que está entre la aplicación y el Method (excluyendo query params)
            const serviceSegments = pathSegments.slice(1, pathSegments.length - 2).filter(s => !s.includes('__'));
            fileService.textContent = serviceSegments.join('/');

            // Extraer y mostrar query params si existen
            const queryParams = pathSegments.filter(s => s.includes('__')).map(s => {
                const [key, value] = s.split('__');
                return `${key}=${value}`;
            });
            fileQueryParams.textContent = queryParams.join('&');

            // Mostrar la sección de detalles y editor
            fileDetailsEditor.style.display = 'block';
            createFormContainer.style.display = 'none';
        } else {
            editor.set({ error: 'Failed to get object' });
        }
    }

    saveButton.addEventListener('click', async function() {
        try {
            const updatedContent = editor.get(); // Obtener el contenido actualizado del editor

            const response = await fetch('/file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: sessionStorage.getItem('idToken')
                },
                body: JSON.stringify({
                    key: currentFileKey,
                    content: updatedContent
                }),
            });

            if (response.status === 401) {
                sessionStorage.removeItem('idToken');
                showLogin();
                return;
            }

            const result = await response.json();
            if (result.success) {
                alert('File saved successfully!');
                // Ocultar la sección de detalles y editor después de guardar
                fileDetailsEditor.style.display = 'none';
            } else {
                alert('Failed to save file.');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    });

    cancelButton.addEventListener('click', function() {
        editor.set({}); // Limpiar el editor
        console.log('Editing canceled');
        // Ocultar la sección de detalles y editor cuando se cancela la edición
        fileDetailsEditor.style.display = 'none';
    });

    deleteButton.addEventListener('click', async function() {
        try {
            const response = await fetch('/file', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: sessionStorage.getItem('idToken')
                },
                body: JSON.stringify({
                    key: currentFileKey
                }),
            });

            if (response.status === 401) {
                sessionStorage.removeItem('idToken');
                showLogin();
                return;
            }

            const result = await response.json();
            if (result.success) {
                alert('File deleted!');
                // Ocultar la sección de detalles y editor después de guardar
                fileExplorer.innerHTML = ''; // Limpiar y recargar el árbol
                loadFileExplorer();
                fileDetailsEditor.style.display = 'none';
            } else {
                alert('Failed to delete file.');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    });

    // Mostrar u ocultar el formulario de creación
    showCreateFormButton.addEventListener('click', function() {
        fileDetailsEditor.style.display = 'none';
        createFormContainer.style.display = 'block';
    });

    // Manejar la cancelación del formulario de creación
    cancelCreateButton.addEventListener('click', function(e) {
        e.preventDefault();
        createFormContainer.style.display = 'none';
        fileDetailsEditor.style.display = 'none';
    });

    // Manejar el envío del formulario para crear un nuevo mock
    createForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        // Obtener los valores del formulario
        const application = document.getElementById('application').value.trim();
        const service = document.getElementById('service').value.trim();
        const queryParams = document.getElementById('queryParams').value.trim();
        const method = document.getElementById('method').value.trim();
        const jsonContent = createEditor.get(); // Usar el editor JSON para obtener el contenido

        // Construir la ruta en S3
        let s3Key = `${application}/${service}`;

        if (queryParams) {
            const paramsArray = queryParams.split('&');
            paramsArray.forEach(param => {
                const [key, value] = param.split('=');
                s3Key += `/${key}__${value}`;
            });
        }

        s3Key += `/${method}/response.json`;

        // Enviar el contenido del JSON al servidor para que lo guarde en S3
        try {
            const response = await fetch('/file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: sessionStorage.getItem('idToken')
                },
                body: JSON.stringify({
                    key: s3Key,
                    content: jsonContent
                }),
            });

            if (response.status === 401) {
                sessionStorage.removeItem('idToken');
                showLogin();
                return;
            }

            const result = await response.json();
            if (result.success) {
                alert('Mock service created successfully!');
                // Recargar el árbol de archivos para mostrar el nuevo archivo
                fileExplorer.innerHTML = ''; // Limpiar y recargar el árbol
                loadFileExplorer();
                createFormContainer.style.display = 'none'; // Ocultar el formulario después de la creación
            } else {
                alert('Failed to create mock service.');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    });

    // Inicializar el explorador de archivos con el prefijo raíz
    loadFileExplorer();
});

function decodeKey(encodedKey) {
    try {
        const decoded = decodeURIComponent(encodedKey.replace(/__/g, '/'));
        return decoded;
    } catch (e) {
        return encodedKey;
    }
}
