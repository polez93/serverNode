import fetch from 'node-fetch';
import express from 'express';
import bodyParser from 'body-parser';
import mysql from 'mysql';
const app = express();
const port = 3000;

const botToken = '7173196466:AAEtb6a_I4NtqZhLlBuMUpdQf2pJAO-SzOs';
var chatId = '5073796031'; 

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
    // Envía una respuesta al Arduino después de completar las operaciones

    //consultar el contacto del cleinte relacionado al sensor
    const queryTele = `SELECT sensores_cliente.telefono AS idtelegram
                        FROM sensores_cliente JOIN sensores_granja ON sensores_cliente.id = sensores_granja.cliente_id 
                        JOIN sensores_instalacion ON sensores_granja.id = sensores_instalacion.granja_id
                        JOIN sensores_sensor ON sensores_instalacion.id = sensores_sensor.instalacion_id 
                        WHERE sensores_sensor.id = ?`;
    db.query(queryTele, [sensor_id], (err, result) => {
        if (err) {
            console.error('Error fetching id telegram:', err);
            return res.status(500).send('Server error');
        }

        const idTele = result[0].idtelegram;
        console.log('Valor del id telegram:', idTele);
        chatId = idTele;

    });
    
    //consulta valor max y min de sensor
    const queryMax = "SELECT maxValor AS max_valor FROM sensores_sensor WHERE id = ?";
    db.query(queryMax, [sensor_id], (err, result) => {
        if (err) {
            console.error('Error fetching max value:', err);
            return res.status(500).send('Server error');
        }

        const maxValor = result[0].max_valor;
        console.log('Max value for sensor:', maxValor);

        // Aquí puedes realizar la comparación del maxValor con el valor que desees
        if (analogValue > maxValor) {
            console.log('Nuevo valor supera el valor máximo registrado!');
            // Aquí podrías llamar a la función para enviar un mensaje a Telegram, por ejemplo
            enviarNotificacionTelegram(`¡Alerta! El valor actual ${analogValue} ha superado el valor máximo registrado: ${maxValor}`);
        }
        //res.status(200).send('Data inserted and max value checked successfully');
    });
    const queryMin = "SELECT minValor AS min_valor FROM sensores_sensor WHERE id = ?";
    db.query(queryMin, [sensor_id], (err, result) => {
        if (err) {
            console.error('Error fetching min value:', err);
            return res.status(500).send('Server error');
        }

        const minValor = result[0].min_valor;
        console.log('Min value for sensor:', minValor);

        // Aquí puedes realizar la comparación del maxValor con el valor que desees
        if (analogValue < minValor) {
            console.log('Nuevo valor es menor al valor mínimo registrado!');
            // Aquí podrías llamar a la función para enviar un mensaje a Telegram, por ejemplo
            enviarNotificacionTelegram(`¡Alerta! El valor actual ${analogValue} es menor al humbral registrado: ${minValor}`);
        }
        //res.status(200).send('Data inserted and max value checked successfully');
    });
   
});

// Inicia el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});

//Procesar mensaje para notificacion a Telegram


 // El ID del chat o canal al que quieres enviar el mensaje


async function enviarNotificacionTelegram(mensaje) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: mensaje
        })
    });

    const data = await response.json();
    
    if (!data.ok) {
        console.error('Error al enviar el mensaje:', data.description);
    } else {
        console.log('Mensaje enviado con éxito');
    }
}