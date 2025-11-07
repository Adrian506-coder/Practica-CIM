# python.exe -m venv .venv
# cd .venv/Scripts
# activate.bat
# py -m ensurepip --upgrade
# pip install -r requirements.txt

from functools import wraps
from flask import Flask, render_template, request, jsonify, make_response, session

from flask_cors import CORS, cross_origin

import mysql.connector.pooling
import pusher
import pytz
import datetime
import traceback

app            = Flask(__name__)
app.secret_key = "Test12345"
CORS(app)

con = mysql.connector.connect(
    host="185.232.14.52",
    database="u760464709_23005038_bd",
    user="u760464709_23005038_usr",
    password="=1OcQV3fbJ"
)

# TRAJES
def pusherSucursal():
    import pusher
    
    pusher_client = pusher.Pusher(
    app_id="2046017",
    key="b51b00ad61c8006b2e6f",
    secret="d2ec35aa5498a18af7bf",
    cluster="us2",
    ssl=True
    )
    
    pusher_client.trigger("canalsucursal", "eventosucursal", {"message": "Hola Mundo!"})


def login(fun):
    @wraps(fun)
    def decorador(*args, **kwargs):
        if not session.get("login"):
            return jsonify({
                "estado": "error",
                "respuesta": "No has iniciado sesión"
            }), 401
        return fun(*args, **kwargs)
    return decorador

@app.errorhandler(Exception)
def handle_exception(e):
    print("❌ ERROR DETECTADO EN FLASK ❌")
    traceback.print_exc()
    return make_response(jsonify({"error": str(e)}), 500)

@app.route("/")
def landingPage():
    
    return render_template("landing-page.html")

@app.route("/dashboard")
def dashboard():
    
    return render_template("dashboard.html")

@app.route("/login")
def appLogin():
    
    return render_template("login.html")
    # return "<h5>Hola, soy la view app</h5>"

@app.route("/fechaHora")
def fechaHora():
    tz    = pytz.timezone("America/Matamoros")
    ahora = datetime.datetime.now(tz)
    return ahora.strftime("%Y-%m-%d %H:%M:%S")

@app.route("/iniciarSesion", methods=["POST"])
# Usar cuando solo se quiera usar CORS en rutas específicas
# @cross_origin()
def iniciarSesion():
    if not con.is_connected():
        con.reconnect()
    usuario    = request.form["usuario"]
    contrasena = request.form["contrasena"]

    cursor = con.cursor(dictionary=True)
    sql    = """
    SELECT Id_Usuario, Nombre_Usuario, Tipo_Usuario
    FROM usuarios
    WHERE Nombre_Usuario = %s
    AND Contrasena = %s
    """
    val    = (usuario, contrasena)

    cursor.execute(sql, val)
    registros = cursor.fetchall()
    if cursor:
        cursor.close()
    if con and con.is_connected():
        con.close()

    session["login"]      = False
    session["login-usr"]  = None
    session["login-tipo"] = 0
    if registros:
        usuario = registros[0]
        session["login"]      = True
        session["login-usr"]  = usuario["Nombre_Usuario"]
        session["login-tipo"] = usuario["Tipo_Usuario"]

    return make_response(jsonify(registros))

@app.route("/cerrarSesion", methods=["POST"])
@login
def cerrarSesion():
    session["login"]      = False
    session["login-usr"]  = None
    session["login-tipo"] = 0
    return make_response(jsonify({}))

@app.route("/preferencias")
@login
def preferencias():
    return make_response(jsonify({
        "usr": session.get("login-usr"),
        "tipo": session.get("login-tipo", 2)
    }))

# sucursal
@app.route("/sucursal")
@login
def sucursal():
    return render_template("sucursal.html")

@app.route("/tbodysucursal")
@login
def tbodysucursal():
    if not con.is_connected():
        con.reconnect()
    cursor = con.cursor(dictionary=True)
    sql    = """
    SELECT Id_sucursal,
           Nombre,
           Categoria,
           Direccion

    FROM sucursal

    ORDER BY Id_sucursal DESC

    LIMIT 10 OFFSET 0
    """

    cursor.execute(sql)
    registros = cursor.fetchall()

    return render_template("tbodysucursal.html", sucursal=registros)

@app.route("/sucursal/buscar", methods=["GET"])
@login
def buscarsucursal():
    if not con.is_connected():
        con.reconnect()

    args     = request.args
    busqueda = args["busqueda"]
    busqueda = f"%{busqueda}%"
    
    cursor = con.cursor(dictionary=True)
    sql    = """
    SELECT Id_sucursal,
           Nombre,
           Categoria,
           Direccion

    FROM sucursal

    WHERE Nombre LIKE %s
    OR    Categoria          LIKE %s
    OR    Direccion          LIKE %s

    ORDER BY Id_sucursal DESC

    LIMIT 10 OFFSET 0
    """
    val    = (busqueda, busqueda, busqueda)

    try:
        cursor.execute(sql, val)
        registros = cursor.fetchall()

    except mysql.connector.errors.ProgrammingError as error:
        print(f"Ocurrió un error de programación en MySQL: {error}")
        registros = []

    finally:
        con.close()

    return make_response(jsonify(registros))

@app.route("/sucursal/categorias", methods=["GET"])
@login
def sucursalcategoria():
    if not con.is_connected():
        con.reconnect()

    args     = request.args
    categoria = args["categoria"]
    
    cursor = con.cursor(dictionary=True)
    sql    = """
    SELECT Nombre
    FROM sucursal

    WHERE categoria = %s
    ORDER BY Nombre ASC

    LIMIT 10 OFFSET 0
    """
    val    = (categoria, )

    try:
        cursor.execute(sql, val)
        registros = cursor.fetchall()

    except mysql.connector.errors.ProgrammingError as error:
        print(f"Ocurrió un error de programación en MySQL: {error}")
        registros = []

    finally:
        con.close()

    return make_response(jsonify(registros))

@app.route("/sucursal/guardar", methods=["POST", "GET"])
@login
def guardarsucursal():
    if not con.is_connected():
        con.reconnect()

    if request.method == "POST":
        data = request.get_json(silent=True) or request.form
        Id_sucursal = data.get("txtIdsucursal")
        Nombre = data.get("txtNombre")
        Direccion = data.get("txtDireccion")
        Categoria = data.get("txtCategoria")
    else: 
        Nombre = request.args.get("Nombre")
        Direccion = request.args.get("Direccion")
        Categoria = request.args.get("Categoria")
    if not Nombre or not Direccion  or not Categoria:
        return jsonify({"error": "Faltan parámetros"}), 400
        
    cursor = con.cursor()
    
    if Id_sucursal:
        sql = """
        UPDATE  sucursal
            SET Nombre = %s,
            Direccion = %s,
            Categoria = %s
        WHERE Id_sucursal = %s
        """
        cursor.execute(sql, (Nombre, Descripcion, Categoria, Id_sucursal))
        
        pusherSucursal()
    else: 
        sql = """
        INSERT INTO sucursal (Nombre, Direccion, Categoria)
        VALUES (%s, %s, %s)
        """
        cursor.execute(sql, (Nombre, Direccion, Categoria))

        pusherSucursal()

    con.commit()
    con.close()
    return make_response(jsonify({"mensaje": "Sucursal guardado correctamente"}))

@app.route("/sucursal/<int:id>")
@login
def editarsucursal(id):
    if not con.is_connected():
        con.reconnect()

    cursor = con.cursor(dictionary=True)
    sql    = """
    SELECT Id_sucursal, Nombre, Direccion, Categoria

    FROM sucursal

    WHERE Id_sucursal = %s
    """
    val    = (id,)

    cursor.execute(sql, val)
    registros = cursor.fetchall()
    con.close()

    return make_response(jsonify(registros))

@app.route("/productos/inventario/<int:id>")
@login
def productosIngredientes(id):
    if not con.is_connected():
        con.reconnect()

    cursor = con.cursor(dictionary=True)
    sql    = """
    SELECT 
        s.Id_sucursal,
        s.Nombre,
        p.Id_producto,
        p.Nombre_Producto,
        i.Existencias
    FROM inventario AS i
    INNER JOIN productos AS p
        ON i.Id_producto = p.Id_producto
    INNER JOIN sucursal AS s
        ON i.Id_sucursal = s.Id_sucursal
    WHERE i.Id_sucursal = %s
    ORDER BY p.Nombre_Producto;
    """
    val    = (id,)

    cursor.execute(sql, val)
    registros = cursor.fetchall()
    if cursor:
        cursor.close()
    if con and con.is_connected():
        con.close()

    return make_response(jsonify(registros))
# @app.route("/trajes/eliminar", methods=["POST", "GET"])
# @login
# def eliminartraje():
#     if not con.is_connected():
#         con.reconnect()

#     if request.method == "POST":
#         IdTraje = request.form.get("id")
#     else:
#         IdTraje = request.args.get("id")

#     IdTraje = int(IdTraje)
    
#     cursor = con.cursor()
#     sql = "DELETE FROM trajes WHERE IdTraje = %s"
#     val = (IdTraje,)

#     cursor.execute(sql, val)
#     con.commit()
#     con.close()

#     pusherProductos()

#     return make_response(jsonify({"status": "ok"}))









