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
    const readings = req.body; // Ahora espera un arreglo de lecturas



    const now = new Date();

    // Obtener la fecha actual en formato ISO 8601 (YYYY-MM-DD)
    const fecha = now.toISOString().slice(0, 10);

    // Obtener la hora actual en formato HH:MM:SS
    const hora = now.toTimeString().slice(0, 8);

    Promise.all(
        readings.map((reading) => {
          return new Promise((resolve, reject) => {
            const analogValue = reading.sensorValue;
            const sensor_id = parseInt(reading.sensor_id);
      
            // Inserta la lectura en la base de datos
            const insertQuery = "INSERT INTO sensores_lectura (valor, fecha, hora, sensor_id) VALUES (?,?,?,?)";
            db.query(insertQuery, [analogValue, fecha, hora, sensor_id], (err, result) => {
              if (err) return reject(`Error inserting client: ${err}`);
      
              // Consulta el id de Telegram del cliente asociado al sensor
              const queryTele = `SELECT sensores_cliente.telefono AS idtelegram
                                  FROM sensores_cliente JOIN sensores_granja ON sensores_cliente.id = sensores_granja.cliente_id 
                                  JOIN sensores_instalacion ON sensores_granja.id = sensores_instalacion.granja_id
                                  JOIN sensores_sensor ON sensores_instalacion.id = sensores_sensor.instalacion_id 
                                  WHERE sensores_sensor.id = ?`;
              db.query(queryTele, [sensor_id], (err, result) => {
                if (err) return reject(`Error fetching id telegram: ${err}`);
      
                const idTele = result[0]?.idtelegram;
                const maxQuery = "SELECT maxValor AS max_valor FROM sensores_sensor WHERE id = ?";
                const minQuery = "SELECT minValor AS min_valor FROM sensores_sensor WHERE id = ?";
      
                // Consulta max y min valores del sensor
                db.query(maxQuery, [sensor_id], (err, result) => {
                  if (err) return reject(`Error fetching max value: ${err}`);
                  const maxValor = result[0]?.max_valor;
      
                  db.query(minQuery, [sensor_id], (err, result) => {
                    if (err) return reject(`Error fetching min value: ${err}`);
                    const minValor = result[0]?.min_valor;
      
                    // Compara los valores y envía notificaciones si es necesario
                    if (analogValue > maxValor) {
                      enviarNotificacionTelegram(`¡Alerta! El valor actual ${analogValue} ha superado el valor máximo registrado: ${maxValor}`);
                    }
                    if (analogValue < minValor) {
                      enviarNotificacionTelegram(`¡Alerta! El valor actual ${analogValue} es menor al umbral registrado: ${minValor}`);
                    }
      
                    resolve(); // Indica que este proceso ha terminado
                  });
                });
              });
            });
          });
        })
      )
        .then(() => {
          // Solo se envía una vez la respuesta después de completar todas las consultas
          res.status(200).send('Data processed successfully');
        })
        .catch((err) => {
          console.error(err);
          res.status(500).send('Server error');
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