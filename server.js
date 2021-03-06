//----------------MYSQL IMPORTS------------------------//
const {database} = require('./config/helpers');
const config = require('./config/databaseConfig');
const mysql = require('mysql');
const MySQLEvents = require('@rodrigogs/mysql-events');
//-----------------------------------------------------//



const app = require('express');
const router = app.Router();
const server = require('http').createServer(app);
const io = require('socket.io')(server,
    {
        cors: {
          origin: "http://localhost:3000"
        }
      });
io.on('connection', (socket) => { 
    console.log('user connected:' + socket.id);
    socket.on('disconnect', function() {
        console.log('user disconnected: '+socket.id);
      });
});



const updateOrder = require("./actions/updateOrder");


router.get("/", (req, res) => {
    res.json({ response: "I am alive" }).status(200);
  });

server.listen(4001);






let data = Array(0);
let currentData = Array(0);

const program = async () => {
  const connection= config.connection;
  const instance = new MySQLEvents(connection, {
    startAtEnd: true  // to record only new binary logs
});

  await instance.start();

  instance.addTrigger({
    name: 'Monitor all SQL Statements',
    expression: 'tiolanches.wp_woocommerce_order_items', 
    statement: MySQLEvents.STATEMENTS.ALL,
    onEvent: e => {
        currentData = e.affectedRows;

        let newData;

        switch (e.type) {
            case "DELETE":
                // Assign current event (before) data to the newData variable
                newData = currentData[0].before;

                // Find index of the deleted product in the current array, if it was there
                let index = data.findIndex(p => p.id === newData.id);

                // If product is present, index will be gt -1
                if (index > -1) {
                    data = data.filter(p => p.id !== newData.id);
                    io.sockets.emit('delete', data);
                    console.log([...data]);
                } else {
                    return;
                }
                break;

            case "UPDATE":
                newData = currentData[0].after;

                // Find index of the deleted product in the current array, if it was there
                let index2 = data.findIndex(p => p.id === newData.id);

                // If product is present, index will be gt -1
                if (index2 > -1) {
                    data[index2] = newData;
                    io.sockets.emit('update', data);
                    console.log([...data]);
                } else {
                    return;
                }
                break;

            case "INSERT":
                database.table('wp_woocommerce_order_items')
                    .withFields(['order_item_id', 'order_item_name'])
                    .sort({order_item_id: -1})
                    .getAll()
                    .then(prods => {
                        data = prods;
                        io.sockets.emit('insert', data);
                        console.log(data);
                    })
                    .catch(err => console.log(err));
                break;
            default:
                break;
        }
    }
});


  instance.on(MySQLEvents.EVENTS.CONNECTION_ERROR, console.error);
  instance.on(MySQLEvents.EVENTS.ZONGJI_ERROR, console.error);
};

program()
  .then(() => console.log('Waiting for database events...'))
  .catch(console.error);



