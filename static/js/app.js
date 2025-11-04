function activeMenuOption(href) {
    $("#appMenu .nav-link")
    .removeClass("active")
    .removeAttr('aria-current')

    $(`[href="${(href ? href : "#/")}"]`)
    .addClass("active")
    .attr("aria-current", "page")
}

function disableAll() {
    const elements = document.querySelectorAll(".while-waiting")
    elements.forEach(function (el, index) {
        el.setAttribute("disabled", "true")
        el.classList.add("disabled")
    })
}

function enableAll() {
    const elements = document.querySelectorAll(".while-waiting")
    elements.forEach(function (el, index) {
        el.removeAttribute("disabled")
        el.classList.remove("disabled")
    })
}

function debounce(fun, delay) {
    let timer
    return function (...args) {
        clearTimeout(timer)
        timer = setTimeout(function () {
            fun.apply(this, args)
        }, delay)
    }
}

const configFechaHora = {
    locale: "es",
    weekNumbers: true,
    // enableTime: true,
    minuteIncrement: 15,
    altInput: true,
    altFormat: "d/F/Y",
    dateFormat: "Y-m-d",
    // time_24hr: false
}

const DateTime = luxon.DateTime
let lxFechaHora
let diffMs = 0

const app = angular.module("angularjsApp", ["ngRoute"])
app.config(function ($routeProvider, $locationProvider) {
    $locationProvider.hashPrefix("")

    $routeProvider
    .when("/", {
        templateUrl: "/login",
        controller: "loginCtrl"
    })
    .when("/rentas", {
        templateUrl: "/rentas",
        controller: "rentasCtrl"
    })
    .when("/clientes", {
        templateUrl: "/clientes",
        controller: "clientesCtrl"
    })
    .when("/trajes", {
        templateUrl: "/trajes",
        controller: "trajesCtrl"
    })
    .otherwise({
        redirectTo: "/"
    })
})
app.run(["$rootScope", "$location", "$timeout", function($rootScope, $location, $timeout) {
    $rootScope.slide             = ""
    $rootScope.spinnerGrow       = false
    $rootScope.sendingRequest    = false
    $rootScope.incompleteRequest = false
    $rootScope.completeRequest   = false
    $rootScope.login             = localStorage.getItem("login")
    const defaultRouteAuth       = "#/rentas"
    let timesChangesSuccessRoute = 0


    function actualizarFechaHora() {
        lxFechaHora = DateTime.now().plus({
            milliseconds: diffMs
        })

        $rootScope.angularjsHora = lxFechaHora.setLocale("es").toFormat("hh:mm:ss a")
        $timeout(actualizarFechaHora, 500)
    }
    actualizarFechaHora()


    let preferencias = localStorage.getItem("preferencias")
    try {
        preferencias = (preferencias ? JSON.parse(preferencias) :  {})
    }
    catch (error) {
        preferencias = {}
    }
    $rootScope.preferencias = preferencias


    $rootScope.$on("$routeChangeSuccess", function (event, current, previous) {
        $rootScope.spinnerGrow = false
        const path             = current.$$route.originalPath


        // AJAX Setup
        $.ajaxSetup({
            beforeSend: function (xhr) {
                // $rootScope.sendingRequest = true
            },
            headers: {
                Authorization: `Bearer ${localStorage.getItem("JWT")}`
            },
            error: function (error) {
                $rootScope.sendingRequest    = false
                $rootScope.incompleteRequest = false
                $rootScope.completeRequest   = true

                const status = error.status
                enableAll()

                if (status) {
                    const respuesta = error.responseText
                    console.log("error", respuesta)

                    if (status == 401) {
                        cerrarSesion()
                        return
                    }

                    modal(respuesta, "Error", [
                        {html: "Aceptar", class: "btn btn-lg btn-secondary", defaultButton: true, dismiss: true}
                    ])
                }
                else {
                    toast("Error en la petici&oacute;n.")
                    $rootScope.sendingRequest    = false
                    $rootScope.incompleteRequest = true
                    $rootScope.completeRequest   = false
                }
            },
            statusCode: {
                200: function (respuesta) {
                    $rootScope.sendingRequest    = false
                    $rootScope.incompleteRequest = false
                    $rootScope.completeRequest   = true
                },
                401: function (respuesta) {
                    cerrarSesion()
                },
            }
        })

        // solo hacer si se carga una ruta existente que no sea el splash
        if (path.indexOf("splash") == -1) {
            // validar login
            function validarRedireccionamiento() {
                const login = localStorage.getItem("login")

                if (login) {
                    if (path == "/") {
                        window.location = defaultRouteAuth
                        return
                    }

                    $(".btn-cerrar-sesion").click(function (event) {
                        $.post("cerrarSesion")
                        $timeout(function () {
                            cerrarSesion()
                        }, 500)
                    })
                }
                else if ((path != "/")
                    &&  (path.indexOf("emailToken") == -1)
                    &&  (path.indexOf("resetPassToken") == -1)) {
                    window.location = "#/"
                }
            }
            function cerrarSesion() {
                localStorage.removeItem("JWT")
                localStorage.removeItem("login")
                localStorage.removeItem("preferencias")

                const login      = localStorage.getItem("login")
                let preferencias = localStorage.getItem("preferencias")

                try {
                    preferencias = (preferencias ? JSON.parse(preferencias) :  {})
                }
                catch (error) {
                    preferencias = {}
                }

                $rootScope.redireccionar(login, preferencias)
            }
            $rootScope.redireccionar = function (login, preferencias) {
                $rootScope.login        = login
                $rootScope.preferencias = preferencias

                validarRedireccionamiento()
            }
            validarRedireccionamiento()


            // animate.css
            const active = $("#appMenu .nav-link.active").parent().index()
            const click  = $(`[href^="#${path}"]`).parent().index()

            if ((active <= 0)
            ||  (click  <= 0)
            ||  (active == click)) {
                $rootScope.slide = "animate__animated animate__faster animate__bounceIn"
            }
            else if (active != click) {
                $rootScope.slide  = "animate__animated animate__faster animate__slideIn"
                $rootScope.slide += ((active > click) ? "Left" : "Right")
            }


            // swipe
            if (path.indexOf("rentas") != -1) {
                $rootScope.leftView      = ""
                $rootScope.rightView     = "clientes"
                $rootScope.leftViewLink  = ""
                $rootScope.rightViewLink = "#/clientes"
            }
            else if (path.indexOf("clientes") != -1) {
                $rootScope.leftView      = "rentas"
                $rootScope.rightView     = "trajes"
                $rootScope.leftViewLink  = "#/rentas"
                $rootScope.rightViewLink = "#/trajes"
            }
            else if (path.indexOf("ventas") != -1) {
                $rootScope.leftView      = "clientes"
                $rootScope.rightView     = ""
                $rootScope.leftViewLink  = "#/clientes"
                $rootScope.rightViewLink = ""
            }
            else {
                $rootScope.leftView      = ""
                $rootScope.rightView     = ""
                $rootScope.leftViewLink  = ""
                $rootScope.rightViewLink = ""
            }

            let offsetX
            let threshold
            let startX = 0
            let startY = 0
            let currentX = 0
            let isDragging = false
            let isScrolling = false
            let moved = false
            let minDrag = 5

            function resetDrag() {
                offsetX = -window.innerWidth
                threshold = window.innerWidth / 4
                $("#appSwipeWrapper").get(0).style.transition = "transform 0s ease"
                $("#appSwipeWrapper").get(0).style.transform = `translateX(${offsetX}px)`
            }
            function startDrag(event) {
                if (isScrolling && isPartiallyVisible($("#appContent").get(0))) {
                    resetDrag()
                }

                isDragging  = true
                moved       = false
                isScrolling = false

                startX = getX(event)
                startY = getY(event)

                $("#appSwipeWrapper").get(0).style.transition = "none"
                document.body.style.userSelect = "none"
            }
            function onDrag(event) {
                if (!isDragging
                ||  $(event.target).parents("table").length
                ||  $(event.target).parents("button").length
                ||  $(event.target).parents("span").length
                ||   (event.target.nodeName == "BUTTON")
                ||   (event.target.nodeName == "SPAN")
                || $(event.target).parents(".plotly-grafica").length
                || $(event.target).hasClass("plotly-grafica")) {
                    return
                }

                let x = getX(event)
                let y = getY(event)

                let deltaX = x - startX
                let deltaY = y - startY
                
                if (isScrolling) {
                    if (isPartiallyVisible($("#appContent").get(0))) {
                        resetDrag()
                    }
                    return
                }

                if (!moved) {
                    if (Math.abs(deltaY) > Math.abs(deltaX)) {
                        isScrolling = true
                        return
                    }
                }

                if (Math.abs(deltaX) > minDrag) {
                    moved = true
                }

                currentX = offsetX + deltaX
                $("#appSwipeWrapper").get(0).style.transform = `translateX(${currentX}px)`
                $("#appSwipeWrapper").get(0).style.cursor = "grabbing"

                event.preventDefault()
            }
            function isVisible(element) {
                const rect = element.getBoundingClientRect()
                return rect.left >= 0 && rect.right <= window.innerWidth
            }
            function isPartiallyVisible(element) {
                const rect = element.getBoundingClientRect()
                return rect.right > 0 && rect.left < window.innerWidth
            }
            function endDrag() {
                if (!isDragging) {
                    return
                }
                $("#appSwipeWrapper").get(0).style.cursor = "grab"
                isDragging = false
                document.body.style.userSelect = ""
                if (isScrolling) {
                    if (isPartiallyVisible($("#appContent").get(0))) {
                        resetDrag()
                    }
                    return
                }

                if (!moved) {
                    $("#appSwipeWrapper").get(0).style.transition = "transform 0.3s ease"
                    $("#appSwipeWrapper").get(0).style.transform = `translateX(${offsetX}px)`
                    return
                }

                let delta = currentX - offsetX
                let finalX = offsetX

                let href, visible

                if (delta > threshold && offsetX < 0) {
                    finalX = offsetX + window.innerWidth
                    $("#appContentLeft").css("visibility", "visible")
                    $("#appContentRight").css("visibility", "hidden")
                    href = $("#appContentLeft").children("div").eq(0).attr("data-href")
                    visible = isPartiallyVisible($("#appContentLeft").get(0))
                } else if (delta < -threshold && offsetX > -2 * window.innerWidth) {
                    finalX = offsetX - window.innerWidth
                    $("#appContentLeft").css("visibility", "hidden")
                    $("#appContentRight").css("visibility", "visible")
                    href = $("#appContentRight").children("div").eq(0).attr("data-href")
                    visible = isPartiallyVisible($("#appContentRight").get(0))
                }

                if (href && visible) {
                    resetDrag()
                    $timeout(function () {
                        window.location = href
                    }, 100)
                } else if (!href) {
                    resetDrag()
                    return
                }

                $("#appSwipeWrapper").get(0).style.transition = "transform 0.3s ease"
                $("#appSwipeWrapper").get(0).style.transform = `translateX(${finalX}px)`
                offsetX = finalX
            }
            function getX(event) {
                return event.touches ? event.touches[0].clientX : event.clientX
            }
            function getY(event) {
                return event.touches ? event.touches[0].clientY : event.clientY
            }
            function completeScreen() {
                $(".div-to-complete-screen").css("height", 0)
                const altoHtml    = document.documentElement.getBoundingClientRect().height
                const altoVisible = document.documentElement.clientHeight
                $(".div-to-complete-screen").css("height", ((altoHtml < altoVisible)
                ? (altoVisible - altoHtml)
                : 0) + (16 * 4))
            }

            $(document).off("mousedown touchstart mousemove touchmove click", "#appSwipeWrapper")

            $(document).on("mousedown",  "#appSwipeWrapper", startDrag)
            $(document).on("touchstart", "#appSwipeWrapper", startDrag)
            $(document).on("mousemove",  "#appSwipeWrapper", onDrag)
            // $(document).on("touchmove",  "#appSwipeWrapper", onDrag)
            document.querySelector("#appSwipeWrapper").addEventListener("touchmove", onDrag, {
                passive: false
            })
            $(document).on("mouseup",    "#appSwipeWrapper", endDrag)
            $(document).on("mouseleave", "#appSwipeWrapper", endDrag)
            $(document).on("touchend",   "#appSwipeWrapper", endDrag)
            $(document).on("click",      "#appSwipeWrapper", function (event) {
                if (moved) {
                    event.stopImmediatePropagation()
                    event.preventDefault()
                    return false
                }
            })
            $(window).on("resize", function (event) {
                resetDrag()
                completeScreen()
            })

            resetDrag()


            // solo hacer una vez cargada la animación
            $timeout(function () {
                // animate.css
                $rootScope.slide = ""


                // swipe
                completeScreen()


                // solo hacer al cargar la página por primera vez
                if (timesChangesSuccessRoute == 0) {
                    timesChangesSuccessRoute++
                    

                    // JQuery Validate
                    $.extend($.validator.messages, {
                        required: "Llena este campo",
                        number: "Solo números",
                        digits: "Solo números enteros",
                        min: $.validator.format("No valores menores a {0}"),
                        max: $.validator.format("No valores mayores a {0}"),
                        minlength: $.validator.format("Mínimo {0} caracteres"),
                        maxlength: $.validator.format("Máximo {0} caracteres"),
                        rangelength: $.validator.format("Solo {0} caracteres"),
                        equalTo: "El texto de este campo no coincide con el anterior",
                        date: "Ingresa fechas validas",
                        email: "Ingresa un correo electrónico valido"
                    })


                    // gets
                    const startTimeRequest = Date.now()
                    $.get("fechaHora", function (fechaHora) {
                        const endTimeRequest = Date.now()
                        const rtt            = endTimeRequest - startTimeRequest
                        const delay          = rtt / 2

                        const lxFechaHoraServidor = DateTime.fromFormat(fechaHora, "yyyy-MM-dd hh:mm:ss")
                        // const fecha = lxFechaHoraServidor.toFormat("dd/MM/yyyy hh:mm:ss")
                        const lxLocal = luxon.DateTime.fromMillis(endTimeRequest - delay)

                        diffMs = lxFechaHoraServidor.toMillis() - lxLocal.toMillis()
                    })

                    $.get("preferencias", {
                        token: localStorage.getItem("fbt")
                    }, function (respuesta) {
                        if (typeof respuesta != "object") {
                            return
                        }

                        console.log("✅ Respuesta recibida:", respuesta)

                        const login      = "1"
                        let preferencias = respuesta

                        localStorage.setItem("login", login)
                        localStorage.setItem("preferencias", JSON.stringify(preferencias))
                        $rootScope.redireccionar(login, preferencias)
                    })


                    // events
                    $(document).on("click", ".toggle-password", function (event) {
                        const prev = $(this).parent().find("input")

                        if (prev.prop("disabled")) {
                            return
                        }

                        prev.focus()

                        if ("selectionStart" in prev.get(0)){
                            $timeout(function () {
                                prev.get(0).selectionStart = prev.val().length
                                prev.get(0).selectionEnd   = prev.val().length
                            }, 0)
                        }

                        if (prev.attr("type") == "password") {
                            $(this).children().first()
                            .removeClass("bi-eye")
                            .addClass("bi-eye-slash")
                            prev.attr({
                                "type": "text",
                                "autocomplete": "off",
                                "data-autocomplete": prev.attr("autocomplete")
                            })
                            return
                        }

                        $(this).children().first()
                        .addClass("bi-eye")
                        .removeClass("bi-eye-slash")
                        prev.attr({
                            "type": "password",
                            "autocomplete": prev.attr("data-autocomplete")
                        })
                    })
                }
            }, 500)

            activeMenuOption(`#${path}`)
        }
    })
}])

app.controller("loginCtrl", function ($scope, $http, $rootScope) {
    $("#frmInicioSesion").submit(function (event) {
        event.preventDefault()

        pop(".div-inicio-sesion", 'ℹ️Iniciando sesi&oacute;n, espere un momento...', "primary")

        $.post("iniciarSesion", $(this).serialize(), function (respuesta) {
            enableAll()

            if (respuesta.length) {
                localStorage.setItem("login", "1")
                localStorage.setItem("preferencias", JSON.stringify(respuesta[0]))
                $("#frmInicioSesion").get(0).reset()
                location.reload()
                return
            }

            pop(".div-inicio-sesion", "Usuario y/o contrase&ntilde;a incorrecto(s)", "danger")
        })

        disableAll()
    })
})

app.controller("rentasCtrl", function ($scope, $http) {
    
    function buscarRentas() {
        $.get("/tbodyRentas", function (trsHTML) {
            $("#tbodyRentas").html(trsHTML)
        })
    }

    buscarRentas();

    Pusher.logToConsole = true;
    var pusher = new Pusher('b51b00ad61c8006b2e6f', {
      cluster: 'us2'
    });
    var channel = pusher.subscribe("canalRentas")
    channel.bind("eventoRentas", function(data) {
        buscarRentas()
    });

    $(document).on("click", "#btnBuscarRenta", function() {
        const busqueda = $("#txtBuscarRenta").val().trim();

        if(busqueda === "") {
            buscarRentas();
            return;
        }

        $.get("/rentas/buscar", { busqueda: busqueda }, function(registros) {
            let trsHTML = "";
            registros.forEach(renta => {
                trsHTML += `
                    <tr>
                        <td>${renta.idRenta}</td>
                        <td>${renta.nombreCliente}</td>
                        <td>${renta.nombreTraje}</td>
                        <td>${renta.descripcion}</td>
                        <td>${renta.fechaInicioFormato} ${renta.horaInicioFormato}</td>
                        <td>${renta.fechaFinFormato} ${renta.horaFinFormato}</td>
                        <td>
                            <button class="btn btn-sm btn-danger btn-eliminar" data-id="${renta.idRenta}">Eliminar</button>
                            <button class="btn btn-sm btn-warning btn-editar"
                              data-id="{{ renta.idRenta }}"
                              data-cliente-id="{{ renta.idCliente }}"
                              data-traje-id="{{ renta.idTraje }}"
                              data-descripcion="{{ renta.descripcion }}"
                              data-fechahorainicio="{{ renta.fechaHoraInicioISO }}"
                              data-fechahorafin="{{ renta.fechaHoraFinISO }}">
                              Editar
                            </button></td>
                        </td>
                    </tr>
                `;
            });
            $("#tbodyRentas").html(trsHTML);
        }).fail(function(xhr){
            console.error("Error al buscar rentas:", xhr.responseText);
        });
    });

    // Permitir Enter en input
    $("#txtBuscarRenta").on("keypress", function(e) {
        if(e.which === 13) {
            $("#btnBuscarRenta").click();
        }
    });

    $(document).on("submit", "#frmRenta", function (event) {
        event.preventDefault();

        const idRenta = $("#idRenta").val(); 

        $.post("/renta", {
            idRenta: $("#idRenta").val(),
            cliente: $("#txtIdCliente").val(),
            traje: $("#txtIdTraje").val(),
            descripcion: $("#txtDescripcion").val(),
            fechaHoraInicio: $("#txtFechaInicio").val(),
            fechaHoraFin: $("#txttxtFechaFin").val()

        }, function(response){
            console.log("Renta guardada o actualizada correctamente");
            $("#frmRenta")[0].reset();
            $("#idRenta").val("");
            buscarRentas(); 
        }).fail(function(xhr){
            console.error("Error al guardar/actualizar renta:", xhr.responseText);
        });

    });

    $(document).on("click", "#tbodyRentas .btn-eliminar", function(){
        const id = $(this).data("id");
        if(confirm("¿Deseas eliminar esta renta?")) {
            $.post("/renta/eliminar", {id: id}, function(response){
                console.log("Renta eliminado correctamente");
                buscarRentas(); 
            }).fail(function(xhr){
                console.error("Error al eliminar renta:", xhr.responseText);
            });
        }
    });
        
    $(document).on("click", "#tbodyRentas .btn-editar", function() {
        const id = $(this).data("id");
        const clienteId = $(this).data("clienteId");
        const trajeId = $(this).data("trajeId");
        const descripcion = $(this).data("descripcion");
        const fechaHoraInicio = $(this).data("fechahorainicio");
        const fechaHoraFin = $(this).data("fechahorafin");

        $("#idRenta").val(id);
        $("#txtIdCliente").val(clienteId); 
        $("#txtIdTraje").val(trajeId); 
        $("#txtDescripcion").val(descripcion);
        $("#txtFechaInicio").val(fechaHoraInicio);
        $("#txttxtFechaFin").val(fechaHoraFin);

        const btnGuardar = $("#btnGuardar");
        btnGuardar.text("Actualizar");
        btnGuardar.removeClass("btn-primary").addClass("btn-success");
    });
});

app.controller("clientesCtrl", function ($scope, $http) {

    function cargarTablaClientes() {
        $.get("/tbodyClientes", function(html) {
            $("#tbodyClientes").html(html);
        });
    }

    cargarTablaClientes();

    Pusher.logToConsole = true;
    var pusher = new Pusher("b51b00ad61c8006b2e6f", { cluster: "us2" });
    var channel = pusher.subscribe("canalClientes");
    channel.bind("eventoClientes", function(data) {
        cargarTablaClientes();
    });

     $(document).on("click", "#btnBuscarCliente", function() {
        const busqueda = $("#txtBuscarCliente").val().trim();

        if(busqueda === "") {
            cargarTablaClientes();
            return;
        }

        $.get("/clientes/buscar", { busqueda: busqueda }, function(registros) {
            let trsHTML = "";
            registros.forEach(cliente => {
                trsHTML += `
                    <tr>
                        <td>${cliente.idCliente}</td>
                        <td>${cliente.nombreCliente}</td>
                        <td>${cliente.telefono}</td>
                        <td>${cliente.correoElectronico}</td>
                        <td>
                            <button class="btn btn-danger btn-sm btn-eliminar" data-id="${cliente.idCliente}">Eliminar</button>
                            <button class="btn btn-sm btn-warning btn-editar" data-id="{{ cliente.idCliente }}" data-nombre="{{ cliente.nombreCliente }}" data-telefono="{{ cliente.telefono }}" data-correo="{{ cliente.correoElectronico }}">Editar</button>
                        </td>
                    </tr>
                `;
            });
            $("#tbodyClientes").html(trsHTML);
        }).fail(function(xhr){
            console.error("Error al buscar clientes:", xhr.responseText);
        });
    });

    // Permitir Enter en input
    $("#txtBuscarCliente").on("keypress", function(e) {
        if(e.which === 13) {
            $("#btnBuscarCliente").click();
        }
    });

    $(document).on("submit", "#frmCliente", function (event) {
        event.preventDefault();

        const idCliente = $("#idCliente").val(); 

        $.post("/cliente", {
            idCliente: idCliente,
            nombreCliente: $("#txtNombreCliente").val(),
            telefono: $("#txtTelefono").val(),
            correoElectronico: $("#txtCorreoElectronico").val()
        }, function(response){
            console.log("Cliente guardado o actualizado correctamente");
            $("#frmCliente")[0].reset();
            $("#idCliente").val(""); // limpiar campo oculto
            cargarTablaClientes(); 

            const btnGuardar = $("#btnGuardar");
            btnGuardar.text("Guardar");
            btnGuardar.removeClass("btn-success").addClass("btn-primary");
        }).fail(function(xhr){
            console.error("Error al guardar/actualizar cliente:", xhr.responseText);
        });

    });

    $(document).on("click", "#tbodyClientes .btn-eliminar", function(){
        const id = $(this).data("id");
        if(confirm("¿Deseas eliminar este cliente?")) {
            $.post("/clientes/eliminar", {id: id}, function(response){
                console.log("Cliente eliminado correctamente");
                cargarTablaClientes(); 
            }).fail(function(xhr){
                console.error("Error al eliminar cliente:", xhr.responseText);
            });
        }
    });
        
    $(document).on("click", "#tbodyClientes .btn-editar", function() {
        const id = $(this).data("id");
        const nombre = $(this).data("nombre");
        const telefono = $(this).data("telefono");
        const correo = $(this).data("correo");

        $("#idCliente").val(id);
        $("#txtNombreCliente").val(nombre);
        $("#txtTelefono").val(telefono);
        $("#txtCorreoElectronico").val(correo);

        const btnGuardar = $("#btnGuardar");
        btnGuardar.text("Actualizar");
        btnGuardar.removeClass("btn-primary").addClass("btn-success");
    });
});

app.controller("trajesCtrl", function ($scope, $http) {
    function buscarTrajes() {
        $.get("/tbodyTrajes", function (trsHTML) {
            $("#tbodyTrajes").html(trsHTML)
        })
    }
    function editarTraje(id) {
        fetch(`/trajes/${id}`)
            .then(response => response.json())
            .then(data => {
                if (data.length > 0) {      
                    const traje = data[0];

                    console.log("Nombre:", traje.nombreTraje);
                    console.log("Descripción:", traje.descripcion);
                    console.log("ID del traje:", traje.IdTraje);
                    
                    $scope.txtNombre = traje.nombreTraje;
                    $scope.txtDescripcion = traje.descripcion;
                    $scope.txtIdTraje = traje.IdTraje;
                    $scope.$apply();
                }
            });
    }

    buscarTrajes()
    
    Pusher.logToConsole = true

    var pusher = new Pusher("b51b00ad61c8006b2e6f", {
      cluster: "us2"
    })

    var channel = pusher.subscribe("canalTrajes")
    channel.bind("eventoTrajes", function(data) {
        buscarTrajes()
    })
    
    $(document).on("click", "#tbodyTrajes .btn-modificar", function(){
        const id = $(this).data("id");
        editarTraje(id);
    });
    $scope.txtIdTraje = null;
    $scope.guardarTraje = function() {
    $http.post("/trajes/guardar", {
            IdTraje: $scope.txtIdTraje,
            txtNombre: $scope.txtNombre,
            txtDescripcion: $scope.txtDescripcion
        }).then(function(respuesta) {
            alert(respuesta.data.mensaje);
            $scope.txtNombre = "";
            $scope.txtDescripcion = "";
            $scope.txtIdTraje = null;
            buscarTrajes();
        }, function(error) {
            console.error(error);
        });
    };

    $(document).on("click", "#btnBuscarTrajes", function() {
    const busqueda = $("#txtBuscarTrajes").val().trim();

    if (busqueda === "") {
        buscarTrajes(); 
        return;
    }

    $.get("/trajes/buscar", { busqueda: busqueda }, function(registros) {
        let trsHTML = "";
        registros.forEach(traje => {
            trsHTML += `
                <tr>
                    <td>${traje.IdTraje}</td>
                    <td>${traje.nombreTraje}</td>
                    <td>${traje.descripcion}</td>
                    <td>
                        <button class="btn btn-danger btn-eliminar" data-id="${traje.IdTraje}">Eliminar</button>
                    </td>
                    <td>
                        <button class="btn btn-warning btn-modificar" data-id="${traje.IdTraje}">Modificar</button>
                    </td>
                </tr>
            `;
        });
        $("#tbodyTrajes").html(trsHTML);
    }).fail(function(xhr){
        console.error("Error al buscar trajes:", xhr.responseText);
    });
});

$("#txtBuscarTrajes").on("keypress", function(e) {
    if(e.which === 13) {
        $("#btnBuscarTrajes").click();
    }
});

    $(document).on("click", "#tbodyTrajes .btn-eliminar", function(){
        const id = $(this).data("id");
        if(confirm("¿Deseas eliminar este traje?")) {
            $.post("/trajes/eliminar", {id: id}, function(response){
                console.log("Traje eliminado correctamente");
                 buscarTrajes()
            }).fail(function(xhr){
                console.error("Error al eliminar traje:", xhr.responseText);
            });
        }
    });
})

document.addEventListener("DOMContentLoaded", function (event) {
    activeMenuOption(location.hash)
})

























