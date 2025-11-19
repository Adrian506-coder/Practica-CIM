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

# inventario
def pusherInventario():
    import pusher
    
    pusher_client = pusher.Pusher(
    app_id="2046017",
    key="b51b00ad61c8006b2e6f",
    secret="d2ec35aa5498a18af7bf",
    cluster="us2",
    ssl=True
    )
    
    pusher_client.trigger("canalinventario", "eventoinventario", {"message": "Hola Mundo!"})

# ==========================
# DAO de Compras (Patrón emergente)
# ==========================
class ComprasDAO:
    def _reconnect(self):
        global con
        if not con.is_connected():
            con.reconnect()

    def listar(self):
        self._reconnect()
        cursor = con.cursor(dictionary=True)
        sql = """
            SELECT 
                c.Id_Compra,
                c.Cantidad,
                c.FechaCompra,
                c.Motivo,
                p.Nombre_Producto,
                pr.Nombre AS Proveedor,
                s.Nombre  AS Sucursal
            FROM compras c
            JOIN productos   p  ON c.Id_Producto   = p.Id_producto
            JOIN Proveedores pr ON c.Id_Proveedor  = pr.Id_Proveedor
            JOIN sucursal    s  ON c.Id_Sucursal   = s.Id_sucursal
        """
        cursor.execute(sql)
        registros = cursor.fetchall()
        cursor.close()
        return registros

    def eliminar(self, id_compra):
        self._reconnect()
        cursor = con.cursor()
        sql = "DELETE FROM compras WHERE Id_Compra = %s"
        cursor.execute(sql, (id_compra,))
        con.commit()
        cursor.close()
        
# Fin--------------------------

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

@app.route("/sucursal/inventario/<int:id>")
@login
def sucursalInventario(id):
    if not con.is_connected():
        con.reconnect()

    cursor = con.cursor(dictionary=True)
    sql    = """
    SELECT 
        s.Id_sucursal,
        s.Nombre,
        p.Descripcion,
        p.Id_producto,
        p.Nombre_Producto,
        i.Existencias
    FROM inventario AS i
    INNER JOIN productos AS p
        ON i.Id_producto = p.Id_producto
    INNER JOIN sucursal AS s
        ON i.Id_sucursal = s.Id_sucursal
    WHERE i.Id_sucursal = %s
    ORDER BY p.Nombre_Producto
    """
    val    = (id,)

    cursor.execute(sql, val)
    registros = cursor.fetchall()
    if cursor:
        cursor.close()
    if con and con.is_connected():
        con.close()

    return make_response(jsonify(registros))
@app.route("/sucursal/eliminar", methods=["POST", "GET"])
@login
def eliminarsucursal():
    if not con.is_connected():
        con.reconnect()

    if request.method == "POST":
        Id_sucursal  = request.form.get("id")
    else:
        Id_sucursal  = request.args.get("id")

    Id_sucursal  = int(Id_sucursal)
    
    cursor = con.cursor()
    sql = "DELETE FROM sucursal WHERE Id_sucursal = %s"
    val = (Id_sucursal,)

    cursor.execute(sql, val)
    con.commit()
    con.close()

    pusherSucursal()

    return make_response(jsonify({"status": "ok"}))
    
# inventario
@app.route("/inventario")
@login
def inventario():
    return render_template("inventario.html")

@app.route("/tbodyinventario")
@login
def tbodyinventario():
    if not con.is_connected():
        con.reconnect()
    cursor = con.cursor(dictionary=True)
    sql    = """
    SELECT 
        s.Id_sucursal,
        s.Nombre,
        p.Descripcion,
        p.Id_producto,
        p.Nombre_Producto,
        i.Id_inventario,
        i.Existencias
    FROM inventario AS i
    INNER JOIN productos AS p
        ON i.Id_producto = p.Id_producto
    INNER JOIN sucursal AS s
        ON i.Id_sucursal = s.Id_sucursal
    ORDER BY p.Nombre_Producto
    """

    cursor.execute(sql)
    registros = cursor.fetchall()

    return render_template("tbodyinventario.html", inventario=registros)

@app.route("/inventario/buscar", methods=["GET"])
@login
def buscarinventario():
    if not con.is_connected():
        con.reconnect()

    args = request.args
    busqueda = f"%{args.get('busqueda', '')}%"

    cursor = con.cursor(dictionary=True)
    sql = """
    SELECT 
        s.Id_sucursal,
        s.Nombre,
        p.Descripcion,
        p.Id_producto,
        p.Nombre_Producto,
        i.Id_inventario,
        i.Existencias
    FROM inventario AS i
    INNER JOIN productos AS p
        ON i.Id_producto = p.Id_producto
    INNER JOIN sucursal AS s
        ON i.Id_sucursal = s.Id_sucursal
    WHERE s.Nombre LIKE %s
       OR p.Descripcion LIKE %s
       OR p.Nombre_Producto LIKE %s
       OR i.Existencias LIKE %s
    ORDER BY p.Id_producto DESC
    LIMIT 10 OFFSET 0;
    """
    val = (busqueda, busqueda, busqueda, busqueda)

    try:
        cursor.execute(sql, val)
        registros = cursor.fetchall()
    except mysql.connector.errors.ProgrammingError as error:
        print(f"Ocurrió un error de programación en MySQL: {error}")
        registros = []
    finally:
        cursor.close()

    return make_response(jsonify(registros))

@app.route("/inventario/guardar", methods=["POST", "GET"])
@login
def guardarinventario():
    if not con.is_connected():
        con.reconnect()

    if request.method == "POST":
        data = request.get_json(silent=True) or request.form
        txtIdinventario = data.get("txtIdinventario")
        txtIdsucursal = data.get("txtIdsucursal")
        txtIdproducto = data.get("txtIdproducto")
        txtExistencia = data.get("txtExistencia")
    else: 
        txtIdsucursal = request.args.get("txtIdsucursal")
        txtIdproducto = request.args.get("txtIdproducto")
        txtExistencia = request.args.get("txtExistencia")
    if not txtIdsucursal or not txtIdproducto  or not txtExistencia:
        return jsonify({"error": "Faltan parámetros"}), 400
        
    cursor = con.cursor()
    
    if txtIdinventario:
        sql = """
        UPDATE  inventario
            SET Id_sucursal = %s,
            Id_producto = %s,
            Existencias = %s
        WHERE Id_inventario = %s
        """
        cursor.execute(sql, (txtIdsucursal, txtIdproducto, txtExistencia, txtIdinventario))
        
        pusherInventario()
    else: 
        sql = """
        INSERT INTO inventario  (Id_sucursal, Id_producto, Existencias)
        VALUES (%s, %s, %s)
        """
        cursor.execute(sql, (txtIdsucursal, txtIdproducto, txtExistencia))

        pusherInventario()

    con.commit()
    con.close()
    return make_response(jsonify({"mensaje": "Sucursal guardado correctamente"}))
    
@app.route("/inventario/eliminar", methods=["POST", "GET"])
@login
def eliminarinventario():
    if not con.is_connected():
        con.reconnect()

    if request.method == "POST":
        Id_inventario = request.form.get("id")
    else:
        Id_inventario = request.args.get("id")

    if not Id_inventario:
        return jsonify({"error": "Falta el parámetro id"}), 400

    Id_inventario = int(Id_inventario)

    cursor = con.cursor()
    sql = "DELETE FROM inventario WHERE Id_inventario = %s"
    val = (Id_inventario,)

    try:
        cursor.execute(sql, val)
        con.commit()
    except Exception as e:
        con.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        con.close()

    pusherInventario()

    return make_response(jsonify({"status": "ok", "mensaje": "Inventario eliminado correctamente"}))

@app.route("/log", methods=["GET"])
def logInventario():
    args = request.args
    actividad = args.get("actividad", "Sin actividad")
    descripcion = args.get("descripcion", "Sin descripción")

    tz = pytz.timezone("America/Matamoros")
    ahora = datetime.datetime.now(tz)
    fechaHoraStr = ahora.strftime("%Y-%m-%d %H:%M:%S")

    with open("log-inventario.txt", "a", encoding="utf-8") as f:
        f.write(f"{actividad}\t{descripcion}\t{fechaHoraStr}\n")

    with open("log-inventario.txt", "r", encoding="utf-8") as f:
        log = f.read()

    return log

# ==========================
# COMPRAS
# ==========================
@app.route("/compras")
@login
def compras():
    return render_template("compras.html")

@app.route("/tbodycompra")
@login
def tbodycompra():
    if not con.is_connected():
        con.reconnect()

    cursor = con.cursor(dictionary=True)
    sql = """
    SELECT 
        c.Id_Compra,
        c.Cantidad,
        c.FechaCompra,
        c.Motivo,
        p.Nombre_Producto,
        pr.Nombre AS Proveedor,
        s.Nombre  AS Sucursal
    FROM compras c
    JOIN productos   p  ON c.Id_Producto   = p.Id_producto
    JOIN proveedores pr ON c.Id_Proveedor  = pr.Id_Proveedor
    JOIN sucursal    s  ON c.Id_Sucursal   = s.Id_sucursal
    """

    cursor.execute(sql)
    registros = cursor.fetchall()
    cursor.close()

    return render_template("tbodycompra.html", compras=registros)

@app.route("/compras/listar", methods=["GET"])
@login
def compras_listar():
    dao = ComprasDAO()
    try:
        registros = dao.listar()
        return make_response(jsonify(registros))
    except Exception as e:
        return make_response(jsonify({"error": str(e)}), 500)


@app.route("/compras/eliminar", methods=["POST", "GET"])
@login
def compras_eliminar():
    if request.method == "POST":
        Id_Compra = request.form.get("id")
    else:
        Id_Compra = request.args.get("id")

    if not Id_Compra:
        return jsonify({"error": "Falta id"}), 400

    dao = ComprasDAO()
    try:
        dao.eliminar(int(Id_Compra))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"status": "ok", "mensaje": "Compra eliminada correctamente"})





