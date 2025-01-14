const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
var Minizip = require('minizip-asm.js');

// Ruta a tu archivo de credenciales JSON descargado
const KEYFILEPATH = path.join(__dirname, 'google-credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const FOLDER_ID = '1j3OT0ymhzdOsX6HziW01-lZSdoHkwMbe';

const FILE_TO_UPLOAD_PATH = 'archivo.txt';;

const FILE_UPLOADED_NAME = 'archivo-subido.txt';

// Autenticación con cuenta de servicio
const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
});

// Inicializar el cliente de Google Drive
const driveService = google.drive({ version: 'v3', auth });


async function uploadFile(filePath, fileName, folderKey) {
    try {

        const fileMetadata = {
            name: fileName,
            parents: [folderKey],
        };

        const media = {
            mimeType: 'text/plain',
            body: fs.createReadStream(filePath),
        };

        const response = await driveService.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
        });

        console.log('Archivo subido con ID:', response.data.id);
        console.log('Nombre del archivo subido:', fileName);  // Imprime el nombre del archivo subido
    } catch (error) {
        console.error('Error al subir el archivo:', error);
    }
}
async function makeDatabaseBackup(databaseUrl, databaseUser, databasePassword, databaseName, backupFileName, backupPassword) {
    console.log("DATBASE URL: " + databaseUrl);
    console.log("DATBASE URL: " + databaseUser);
    console.log("DATBASE URL: " + databasePassword);

    const fs = require('fs');
    const path = require('path');
    const mysqldump = require('mysqldump');

    try {
        const tmpDir = path.join(__dirname, 'tmp');

        // Crear el directorio temporal si no existe
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        // Formatear la fecha para el nombre del archivo
        const currentDate = new Date();
        const formattedDate = currentDate.toISOString().replace(/:/g, '-').replace('T', '_').split('.')[0];

        // Utilizar el nombre de archivo proporcionado por el usuario
        const filename = `${backupFileName}_${formattedDate}.sql`;
        const filePath = path.join(tmpDir, filename);

        // Configuración de mysqldump
        const config = {
            connection: {
                host: databaseUrl,
                user: databaseUser,
                password: databasePassword,
                database: databaseName
            },
            dumpToFile: filePath
        };

        // Realizar el backup
        await mysqldump(config);

        console.log(`✅ Backup realizado exitosamente: ${filePath}`);
        return filePath;
    } catch (error) {
        console.error('❌ Error al realizar el backup:', error);
        throw error;
    }
}

async function compressFileToZip(filePath, passwordCompression) {
    try {
        // Crear un directorio temporal
        const tmpDir = path.join(__dirname, 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        // Crear un nombre para el archivo zip
        const zipFileName = path.basename(filePath) + '.zip';
        const zipFilePath = path.join(tmpDir, zipFileName);

        // Leer el archivo a comprimir
        const fileBuffer = fs.readFileSync(filePath);

        // Crear una instancia de Minizip
        const mz = new Minizip();

        // Agregar el archivo con la contraseña
        mz.append(path.basename(filePath), fileBuffer, { password: passwordCompression });

        // Obtener el buffer ZIP comprimido
        const zipBuffer = mz.zip();

        // Escribir el archivo comprimido en el disco
        fs.writeFileSync(zipFilePath, zipBuffer);

        console.log(`Archivo comprimido con éxito en: ${zipFilePath}`);
        return zipFilePath;
    } catch (error) {
        console.error("Error al comprimir el archivo:", error);
    }
}

async function index() {
    const yargs = require('yargs');

    // Usar yargs para leer los argumentos
    const argv = yargs
        .option('databaseUrl', {
            alias: 'u',
            description: 'URL de la base de datos',
            type: 'string',
            demandOption: true,  // Hace que este parámetro sea obligatorio
        })
        .option('databaseUser', {
            alias: 'user',
            description: 'Usuario de la base de datos',
            type: 'string',
            demandOption: true,
        })
        .option('databasePassword', {
            alias: 'password',
            description: 'Contraseña de la base de datos',
            type: 'string',
            default: '',  // Valor por defecto vacío
        })
        .option('databaseName', {
            alias: 'name',
            description: 'Nombre de la base de datos',
            type: 'string',
            demandOption: true,
        })
        .option('backupFileName', {
            alias: 'file',
            description: 'Nombre del archivo de backup',
            type: 'string',
            demandOption: true,
        })
        .option('backupPassword', {
            alias: 'backup-pass',
            description: 'Contraseña para el backup',
            type: 'string',
            demandOption: true,
        })
        .option('folderKey', {
            alias: 'folder',
            description: 'Clave de la carpeta en la nube',
            type: 'string',
            demandOption: true,
        })
        .help()
        .alias('help', 'h')
        .argv;

    try {
        // Usar los valores obtenidos de los argumentos
        const { databaseUrl, databaseUser, databasePassword, databaseName, backupFileName, backupPassword, folderKey } = argv;

        const backupFilePath = await makeDatabaseBackup(databaseUrl, databaseUser, databasePassword, databaseName, backupFileName, backupPassword);
        const backupCompressedFilePath = await compressFileToZip(backupFilePath, backupPassword);
        console.log(backupCompressedFilePath);

        console.log(`Backup generado en: ${backupCompressedFilePath}`);
        await uploadFile(backupCompressedFilePath, backupFileName, folderKey);

        // Si todo salió bien, retornar 0
        process.exit(0); 
    } catch (error) {
        console.error("Error durante la ejecución:", error);

        // Si hubo un error, retornar 1
        process.exit(1); 
    }
}


index();
