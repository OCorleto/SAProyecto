create table Juego(
	id int auto_increment primary key,
    nombre varchar(100)
);

create table Usuario(
	id int auto_increment primary key,
    nombre varchar(100)
);

create table Llave(
	id int auto_increment primary key,
    fase varchar(100)
);

create table Torneo(
	id int auto_increment primary key,
    nombre varchar(100),
    juegoid int,
    ganadorid int,
    llave int,
    FOREIGN KEY (juegoid) REFERENCES Juego(id),
    FOREIGN KEY (ganadorid) REFERENCES Usuario(id)
);

create table Participacion(
	id int auto_increment primary key,
    usuarioid int,
    torneoid int,
    FOREIGN KEY (usuarioid) REFERENCES Usuario(id),
    FOREIGN KEY (torneoid) REFERENCES Torneo(id)
);

create table Partida(
	id int auto_increment primary key,
    numpartida int,
    participacionid int,
    llaveid int,
    FOREIGN KEY (participacionid) REFERENCES Participacion(id),
    FOREIGN KEY (llaveid) REFERENCES Llave(id)
);