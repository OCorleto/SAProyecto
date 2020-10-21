#!/usr/bin/env node
const express = require('express');
const mysql = require('mysql');
const request = require('request')
const cors = require('cors');
const bodyParser = require('body-parser');


const app = express();
app.use(bodyParser.json())
app.use(cors());

/*ip y puerto donde correra el sevidor nodejs*/
const ip = "localhost";
const port = 3000;

/*conexion con la base de datos mysql*/
var conn = mysql.createConnection({
    host: "db",
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

/* Indica la conclusion de la partida */
app.put('/partidas/:id',(req,res)=>{
    var partida = req.params.id
    var marcador = req.body.marcador
    var ganadorid = 0
    var llave=-1
    var sql = "SELECT * FROM Partida WHERE id = "+partida+";"
    conn.query(sql, function (err, result) {
        if (err) {
            res.sendStatus(406) 
            return
        }
        if (result.length == 0){
            res.sendStatus(404)
            return
        }
        if(marcador[0]>marcador[1]){ganadorid = result[0].jugador1}
        else{ganadorid = result[0].jugador2}
        llave = result[0].llave - 1
        if (llave>0){
            var sql = "SELECT p.* "
                    +" FROM Partida p, Participacion part, "
                    +" (SELECT parts.torneoid as torneo FROM Partida ps, Participacion parts "
                    +" WHERE ps.jugador1 = parts.id AND (ps.jugador1 = "+ganadorid+" or ps.jugador2 = "+ganadorid+")) torneo "
                    +" WHERE p.jugador1 = part.id "
                    +" AND torneo.torneo = part.torneoid "
                    +" AND p.jugador2 IS NULL "
                    +" ORDER BY p.id;"
            conn.query(sql, function(err,result){
                if(err){
                    console.log(err)
                    res.sendStatus(406)
                    return
                }
                if (result.length == 0){
                    var sql = "INSERT INTO Partida(jugador1, llave) VALUES("+ganadorid+","+llave+");"
                    conn.query(sql, function(err,result){
                        if (err) {
                            console.log(err)
                            res.sendStatus(406) 
                            return
                        }
                        res.sendStatus(201)
                        return
                    });
                }else{
                    var sql = "UPDATE Partida SET jugador2 = "+ganadorid+" WHERE id = "+result[0].id+";"
                    conn.query(sql, function(err,result){
                        if (err) {
                            console.log(err)
                            res.sendStatus(406) 
                            return
                        }
                        res.sendStatus(201)
                        return
                    });
                }
            });
        }else{
            var sql = "SELECT part.torneoid as torneo FROM Participacion part, Partida p WHERE p.jugador1 = part.id "
                    + "AND p.jugador1 = "+result[0].jugador1+";"
            conn.query(sql, function (err, result) {
                if (err) {
                    res.sendStatus(406) 
                    return
                }
                if (result.length == 0){
                    res.sendStatus(404)
                    return
                }
                var torneowin = result[0].torneo
                var sql = "SELECT part.usuarioid as user FROM Participacion part, Partida p "
                        +" WHERE (p.jugador1 = part.id or p.jugador2 = part.id)  AND part.id = "+ganadorid
                console.log(sql)
                conn.query(sql,function(err, result){
                    var sql = "UPDATE Torneo SET ganadorid = "+result[0].user+" WHERE id = "+torneowin+";"
                    conn.query(sql, function (err, result) {
                        res.sendStatus(201)
                        return
                    });
                });
            });
        }
    });
    
});

/*Asignar llaves aleartorias*/
app.get('/asignarllaves/:torneo',(req,res)=>{
    var torneo = req.params.torneo
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
        bandera = false
        lista.forEach(element => {
            partida.push(element)
            if (!bandera){bandera = true}
            else{
                var sql="INSERT INTO Partida(jugador1,jugador2,llave) VALUES("+partida[0]+","+partida[1]+","+llave+");"
                conn.query(sql,function(err,result){
                    if(err) {
                        res.send({status:err})
                        return
                    }
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
app.get('/verllaves/:torneo',(req,res)=>{
    var torneo = req.params.torneo
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
        sql = "SELECT p.jugador1 as id1, p.jugador2 as id2, u1.nombre n1, u2.nombre as n2, p.llave as llavepart "
            + "FROM Partida p "
            + "INNER JOIN Participacion Part1 on p.jugador1 =part1.id "
            + "INNER JOIN Usuario U1 ON part1.usuarioid =U1.id "
            + "INNER JOIN Participacion Part2 on p.jugador2 =part2.id "
            + "INNER JOIN Usuario U2 ON part2.usuarioid =U2.id "
            + "WHERE Part1.torneoid = "+torneo +";"
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
                        JSONtxt = JSONtxt + '\"jugador1\": \"'+element.n1+'\",'
                        JSONtxt = JSONtxt + '\"jugador2\": \"'+element.n2+"\""
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

/*Ver torneos ya ganados */
app.get('/verganados/',(req,res)=>{
    var sql = "SELECT t.nombre as nombre,t.id as id, u.nombre as user FROM Torneo t, Usuario u WHERE u.id = t.ganadorid AND ganadorid IS NOT NULL;"
    envio = []
    conn.query(sql, function (err, result) {
        if (err) {
            res.send({status:err}) 
            return
        }
        result.forEach(element => {
            envio.push({nombre: element.nombre,ganador:element.ganador,id:element.id})
        });
        res.send(envio)
    });
});

/*Ver torneos presentes */
app.get('/verpresentes/',(req,res)=>{
    var sql = "SELECT t.id as torneo, count(p.usuarioid) as numusers, t.llave as llave, t.nombre as nombre "
            + "FROM Torneo t, Participacion p "
            + "WHERE t.id = p.torneoid "
            + "AND t.ganadorid IS NULL "
            + "GROUP BY p.torneoid "
            + "HAVING numusers = pow(2,llave); "
    envio = []
    conn.query(sql, function (err, result) {
        if (err) {
            res.send({status:err}) 
            return
        }
        result.forEach(element => {
            envio.push({nombre: element.nombre,llaves:element.llave,id:element.torneo})
        });
        res.send(envio)
    });
});

/*Ver torneos futuros */
app.get('/verfuturos/',(req,res)=>{
    var sql = "SELECT t.id as torneo, count(p.usuarioid) as numusers, t.llave as llave, t.nombre as nombre "
            + "FROM Torneo t, Participacion p "
            + "WHERE t.id = p.torneoid "
            + "AND t.ganadorid IS NULL "
            + "GROUP BY p.torneoid "
            + "HAVING numusers < pow(2,llave); "
    envio = []
    conn.query(sql, function (err, result) {
        if (err) {
            res.send({status:err}) 
            return
        }
        result.forEach(element => {
            envio.push({nombre: element.nombre,llaves:element.llave,id:element.torneo})
        });
        res.send(envio)
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
