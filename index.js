const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
var Minizip = require('minizip-asm.js');
const mysqldump = require('mysqldump');

// Ruta a tu archivo de credenciales JSON descargado
const KEYFILEPATH = path.join(__dirname, 'google-credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const driveService = google.drive({ version: 'v3', auth: new google.auth.GoogleAuth({ keyFile: KEYFILEPATH, scopes: SCOPES }) });

const app = express();

// Configurar el middleware para parsear las solicitudes JSON
app.use(bodyParser.json());

// Función para realizar el backup de la base de datos
async function makeDatabaseBackup(databaseUrl, databaseUser, databasePassword, databaseName, backupFileName, backupPassword) {
    try {
        const tmpDir = path.join(__dirname, 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const currentDate = new Date();
        const formattedDate = currentDate.toISOString().replace(/:/g, '-').replace('T', '_').split('.')[0];
        const filename = `${backupFileName}_${formattedDate}.sql`;
        const filePath = path.join(tmpDir, filename);

        console.log("DATABSE URL + " + databaseUrl);

        const config = {
            connection: {
                host: databaseUrl,
                user: databaseUser,
                password: databasePassword,
                database: databaseName
            },
            dumpToFile: filePath
        };

        await mysqldump(config);
        console.log(`Backup realizado exitosamente: ${filePath}`);
        return filePath;
    } catch (error) {
        console.error('Error al realizar el backup:', error);
        throw error;
    }
}

// Función para comprimir el archivo en un ZIP
async function compressFileToZip(filePath, passwordCompression) {
    try {
        const tmpDir = path.join(__dirname, 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const zipFileName = path.basename(filePath) + '.zip';
        const zipFilePath = path.join(tmpDir, zipFileName);

        const fileBuffer = fs.readFileSync(filePath);
        const mz = new Minizip();

        mz.append(path.basename(filePath), fileBuffer, { password: passwordCompression });

        const zipBuffer = mz.zip();
        fs.writeFileSync(zipFilePath, zipBuffer);

        console.log(`Archivo comprimido con éxito en: ${zipFilePath}`);
        return zipFilePath;
    } catch (error) {
        console.error('Error al comprimir el archivo:', error);
        throw error;
    }
}

// Función para subir el archivo a Google Drive
async function uploadFile(filePath, fileName, folderKey) {
    try {
        const fileMetadata = { name: fileName, parents: [folderKey] };
        const media = { mimeType: 'application/zip', body: fs.createReadStream(filePath) };

        const response = await driveService.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
        });

        console.log('Archivo subido con ID:', response.data.id);
        console.log('Nombre del archivo subido:', fileName);
    } catch (error) {
        console.error('Error al subir el archivo:', error);
        throw error;
    }
}

// Endpoint para ejecutar el proceso de backup y subida
app.post('/backup', async (req, res) => {
    const { databaseUrl, databaseUser, databasePassword, databaseName, backupFileName, backupPassword, folderKey } = req.body;

    try {
        const backupFilePath = await makeDatabaseBackup(databaseUrl, databaseUser, databasePassword, databaseName, backupFileName, backupPassword);
        const backupCompressedFilePath = await compressFileToZip(backupFilePath, backupPassword);
        console.log('Backup comprimido:', backupCompressedFilePath);

        await uploadFile(backupCompressedFilePath, backupFileName, folderKey);

        res.status(200).send('Backup realizado y subido con éxito');
    } catch (error) {
        console.error('Error durante el proceso:', error);
        res.status(500).send('Error durante el proceso de backup y subida');
    }
});

app.get('/health', async (req, res) => {
        res.status(200).send('Servicio activo');
});

// Iniciar el servidor en el puerto 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor API escuchando en http://localhost:${PORT}`);
});
