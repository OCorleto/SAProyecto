#!/usr/bin/env node
const express = require('express');
const mysql = require('mysql');
const request = require('request')
const cors = require('cors');
const bodyParser = require('body-parser');
const e = require('express');


const app = express();
app.use(bodyParser.json())
app.use(cors());

/*ip y puerto donde correra el sevidor nodejs*/
const ip = "127.0.0.1";
const port = 3000;

/*conexion con la base de datos mysql*/
var conn = mysql.createConnection({
    host: "localhost",
    port: "3306",
    user: "usuariosa",
    password: "123",
    database: "sa",
    insecureAuth : true
});

app.listen(port,ip, () => {
    console.log('Se escucha en el puerto: %d y con la ip: %s',port,ip);
});

/* Crear nuevo torneo */
app.post('/nuevotorneo/', function (req, res) {
    var nombre = req.body.nombre;
    var juegoid = req.body.juegoid;
    var llave = req.body.llave;
    var sql = "INSERT INTO torneo(nombre,juegoid,llave) VALUES('"+nombre+"',"+juegoid+","+llave+");";
    conn.query(sql, function (err, result) {
        if (err) res.send({status: err});
        else res.send({status:req.body});
    });
});

/*Asignar llaves aleartorias*/
app.get('/asignarllaves/',(req,res)=>{
    var torneo = req.query.ext
    var lista = []
    var llave = 0
    var sql = "SELECT p.id as id, t.llave as llave "+
            "FROM Participacion p, Torneo t "+
            "WHERE p.torneoid = t.id "+
            "AND p.torneoid = "+torneo+";";
    conn.query(sql, function (err, result) {
        if (err) {
            res.send({status:err}) 
            return
        }
        result.forEach(element => {
            lista.push(element.id)
            llave = element.llave
        });
        lista=shuffle(lista)
        partida =[]
        numpartida = 0
        bandera = false
        lista.forEach(element => {
            partida.push(element)
            if (!bandera){bandera = true}
            else{
                numpartida = numpartida+1
                partida.forEach(user=>{
                    var sql="INSERT INTO Partida(numpartida,participacionid,llaveid) VALUES("+numpartida+","+user+","+llave+");"
                    conn.query(sql,function(err,result){if(err) throw err});
                });
                bandera=false
                partida=[]
            }
            
        });
        res.send({lista:lista})
    });

});

/*Asignar usuarios al torneo*/
app.post('/asignarparticipacion/', (req, res,next)=> {
    var usuario = req.body.usuarioid
    var torneo = req.body.torneoid

    var datostorneo = []
    var disponibles = 0
    
    var sql = "SELECT llave,ganadorid FROM Torneo WHERE id = "+torneo+";";
    
    conn.query(sql, function (err, result) {
        if (err) {
            res.send({status:err}) 
            return
        }
        
        datostorneo = JSON.parse(JSON.stringify(result));
        
        if (datostorneo.length == 0){res.send({status : "No existe torneo"})}
        else{datostorneo=datostorneo[0]}
        if( datostorneo.ganadorid != null){res.send({status : "Torneo ya finalizado"})}
        else{
            var sql = "SELECT count(*) as num FROM Participacion WHERE torneoid = "+torneo+";";
            conn.query(sql, function (err, result) {
                if (err) {
                    res.send({status:err}) 
                    return
                }
                disponibles = result[0].num;
                maxusers = Math.pow(2,datostorneo.llave)
                if (disponibles<maxusers){
                    var sql = "SELECT * FROM Participacion WHERE usuarioid = "+usuario+" AND torneoid = "+torneo+";";
                    conn.query(sql, function (err, result) {
                        if (err) {
                            res.send({status:err}) 
                            return
                        }
                        if (JSON.parse(JSON.stringify(result)).length > 0){res.send({status:"Usuario ya registrado en el torneo"})}
                        else{
                            var sql = "INSERT INTO Participacion(usuarioid,torneoid) VALUES("+usuario+","+torneo+");";
                            conn.query(sql, function (err, result) {
                                if (err) {
                                    res.send({status:err}) 
                                    return
                                }
                                disponibles = disponibles+1
                                if (disponibles == maxusers){

                                }
                                res.send({status: "Usuario "+usuario+" asignado a torneo "+torneo});
                            });
                        }
                    });
                }else{res.send({status:"Torneo lleno"})}
            });
        }
    });
});

/* Obtener las llaves de un torneo*/
app.get('/verllaves/',(req,res)=>{
    var torneo = req.query.ext
    var sql = "SELECT * FROM Torneo WHERE id = "+torneo+";"
    var JSONtxt = "{"
    conn.query(sql, function (err, result) {
        if (err) {
            res.send({status:err}) 
            return
        }
        JSONtxt = JSONtxt + '\"nombre\": "'+result[0].nombre+'",'
        JSONtxt = JSONtxt + '\"ganador\": '+result[0].ganadorid+","
        JSONtxt = JSONtxt + '\"llave\": '+result[0].llave+","
        var llaves = result[0].llave
        sql = "SELECT p.numpartida as numpartida, u.nombre as user, llaveid as llavepart "
            + "FROM Participacion part, Partida p, Usuario u "
            + "WHERE part.id = p.participacionid "
            + "AND part.usuarioid = u.id "
            + "AND part.torneoid = "+torneo+";";
        conn.query(sql, function (err, result) {
            if (err) {
                res.send({status:err}) 
                return
            }
            while(llaves>0){
                JSONtxt = JSONtxt + '\"fase' + llaves + '\":['
                result.forEach(element => {
                   if(element.llavepart == llaves){
                       JSONtxt = JSONtxt + "{"
                       JSONtxt = JSONtxt + '\"usuario\": \"'+element.user+'\",'
                       JSONtxt = JSONtxt + '\"numpartida\": '+element.numpartida
                       JSONtxt = JSONtxt + "},"
                   } 
                });
                if (JSONtxt[JSONtxt.length-1]==","){JSONtxt = JSONtxt.slice(0,-1)}
                JSONtxt=JSONtxt+"],"
                llaves = llaves -1

            }
            if (JSONtxt[JSONtxt.length-1]==","){JSONtxt = JSONtxt.slice(0,-1)}
            JSONtxt = JSONtxt + "}"
            JSONtxt = JSON.parse(JSONtxt)
            res.send(JSONtxt)
        });
        
    });
});



/*------------------------- FUNCIONES -------------------------*/
function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
  
      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
  
    return array;
  }