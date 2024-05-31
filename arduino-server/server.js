const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const app = express();
const port = 3000;

// Configuración de la conexión a la base de datos MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'iot'
});
//conexión a la base de datos
db.connect((err) => {
    if (err) {
        console.error('Error conectando a la base de datos:', err.stack);
        return;
    }
    console.log('Conectado a la base de datos MySQL.');
});

// Configura bodyParser para manejar solicitudes JSON
app.use(bodyParser.json());

// Ruta para manejar la solicitud POST del Arduino
app.post('/receive-data', (req, res) => {
    // Extrae el valor analógico del cuerpo de la solicitud
    const analogValue = req.body.sensorValue;
    const sensor_id = parseInt(req.body.sensor_id);

    const now = new Date();

    // Obtener la fecha actual en formato ISO 8601 (YYYY-MM-DD)
    const fecha = now.toISOString().slice(0, 10);

    // Obtener la hora actual en formato HH:MM:SS
    const hora = now.toTimeString().slice(0, 8);

    const query = "INSERT INTO sensores_lectura (valor,fecha,hora,sensor_id) VALUES (?,?,?,?)";
    db.query(query, [analogValue, fecha, hora, sensor_id], (err, result) => {
        if (err) {
            console.error('Error inserting client:', err);
            return res.status(500).send('Server error');
        }
        res.status(200).send('data inserted successfully');  // Envía una respuesta al Arduino
    });

    console.log(`Valor analógico recibido:${sensor_id}, ${analogValue}`);

    // Envía una respuesta al Arduino
   
});

// Inicia el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});