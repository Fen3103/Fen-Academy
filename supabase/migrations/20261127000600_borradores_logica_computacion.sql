-- =============================================================================
--  Clases en borrador + primer contenido de LOG-1, LOG-2 y COMP-1.
--   - Las clases pueden quedar ocultas (borrador) hasta que el profesor las publique.
--   - Se cargan clases, 3 tareas (10 % c/u) y el proyecto (30 %) de cada curso,
--     TODO como borrador: nadie lo ve hasta revisarlo y publicarlo.
--   - Los exámenes (3 × 10 %) y la participación (10 %) se hacen en clase y los
--     crea el profesor; las fechas límite también las pone él.
--   - Si ya existe una clase o actividad con el mismo título en el curso, no se toca.
-- =============================================================================

-- ------------------------------------------------------- clases borrador ---
alter table public.clases add column if not exists publicada boolean not null default true;

drop policy if exists clases_ver on public.clases;
create policy clases_ver on public.clases for select to authenticated
    using ((publicada and fen.esta_matriculado(curso_id)) or fen.es_docente(curso_id));

-- ---------------------------------------------------------------- clases ---
insert into public.clases (curso_id, orden, titulo, descripcion, publicada)
select c.id, v.orden, v.titulo, v.descripcion, false
from (values

-- =============================== LOG-1 =======================================
('LOG-1', 1, 'Qué es un algoritmo y el primer pseudocódigo', $md$
**Objetivo:** entender qué es un algoritmo, describir un problema como entrada, proceso y salida y escribir el primer programa en pseudocódigo.

**1. ¿Qué es un algoritmo?**
Una lista de pasos **ordenados**, **precisos** y **finitos** para resolver un problema. Ejemplos de la vida diaria: una receta, las instrucciones para llegar a un lugar, cómo cambiar una llanta.
- Ordenado: el orden importa (no se fríe el huevo antes de romperlo).
- Preciso: cada paso se entiende de una sola forma.
- Finito: en algún momento termina.

**Actividad en clase:** escribir en parejas el algoritmo de "preparar café" y que el otro lo siga al pie de la letra. ¿Qué pasos faltaron?

**2. Entrada, proceso y salida**
Todo problema se puede describir así:
- **Entrada:** los datos que necesito (lo que el usuario escribe).
- **Proceso:** lo que hago con esos datos (cálculos, decisiones).
- **Salida:** el resultado que muestro.

Ejemplo, el área de un rectángulo: entrada = base y altura; proceso = base × altura; salida = el área.

**3. El primer pseudocódigo**
El pseudocódigo es el algoritmo escrito "casi" como un programa, en español. Lo vamos a ejecutar en el **Laboratorio** del curso.

```pseudocodigo
Algoritmo Saludo
    Definir nombre Como Texto
    Escribir "¿Cómo te llamás?"
    Leer nombre
    Escribir "Hola, ", nombre, ". Bienvenido a Fen Academy."
FinAlgoritmo
```

- `Algoritmo … FinAlgoritmo`: el inicio y el fin.
- `Definir`: crea una variable y dice de qué tipo es.
- `Leer`: pide un dato (en el Laboratorio se escribe en la pestaña **Entrada**).
- `Escribir`: muestra en pantalla.

**Práctica en clase (Laboratorio):**
1. Ejecutar el ejemplo de arriba.
2. Pedir nombre y ciudad, y mostrar "Ana vive en Cartago".
3. Pedir dos números y mostrar su suma.
$md$),

('LOG-1', 2, 'Variables, tipos de datos, operadores y diagramas de flujo', $md$
**Objetivo:** guardar datos en variables, hacer cálculos y dibujar el algoritmo como diagrama de flujo.

**1. Variables y tipos de datos**
Una variable es una "caja" con nombre donde guardo un valor que puede cambiar.

| Tipo | Guarda | Ejemplo |
|---|---|---|
| Entero | números sin decimales | 25 |
| Real | números con decimales | 3.75 |
| Texto | letras y símbolos | "Hola" |
| Logico | Verdadero o Falso | Verdadero |

Reglas para los nombres: sin espacios, sin empezar con número y que digan qué guardan (`precio`, `edad`, `totalPagar`).

**2. Asignación y operadores**
Con `<-` guardo un valor: `edad <- 18`.

| Operador | Significado | Ejemplo | Resultado |
|---|---|---|---|
| + − * / | suma, resta, multiplicación, división | 7 / 2 | 3.5 |
| ^ | potencia | 2 ^ 3 | 8 |
| MOD | residuo de la división | 7 MOD 2 | 1 |
| TRUNC | parte entera | TRUNC(7 / 2) | 3 |

Precedencia: primero paréntesis, después ^, después * / MOD, y al final + −. `2 + 3 * 4` da 14; `(2 + 3) * 4` da 20.

```pseudocodigo
Algoritmo PrecioConIVA
    Definir precio, iva, total Como Real
    Escribir "Precio del producto:"
    Leer precio
    iva <- precio * 0.13
    total <- precio + iva
    Escribir "IVA: ", iva
    Escribir "Total a pagar: ", total
FinAlgoritmo
```

**3. Diagramas de flujo**
El mismo algoritmo, dibujado:
- **Óvalo:** inicio y fin.
- **Paralelogramo:** entrada (Leer) y salida (Escribir).
- **Rectángulo:** proceso (cálculos, asignaciones).
- **Rombo:** decisión (la vemos en la próxima clase).
- **Flechas:** el orden en que se recorren los pasos.

Se puede dibujar en papel o en draw.io (gratis, en el navegador).

**Práctica en clase:**
1. Convertir minutos a horas y minutos (125 → 2 h 5 min) usando TRUNC y MOD.
2. Dibujar el diagrama de flujo de PrecioConIVA.

**Examen I** al final de la clase.
$md$),

('LOG-1', 3, 'Condiciones: Si, SiNo y Segun', $md$
**Objetivo:** que el algoritmo tome decisiones.

**1. Operadores de comparación y lógicos**

| Comparación | Significa |
|---|---|
| = | igual |
| <> | distinto |
| > < >= <= | mayor, menor, mayor o igual, menor o igual |

Lógicos: `Y` (las dos condiciones se cumplen), `O` (al menos una), `NO` (lo contrario).
Ejemplo: `edad >= 18 Y tieneCedula`.

**2. Si … Entonces … SiNo**

```pseudocodigo
Algoritmo ParOImpar
    Definir n Como Entero
    Escribir "Escribí un número:"
    Leer n
    Si n MOD 2 = 0 Entonces
        Escribir n, " es par"
    SiNo
        Escribir n, " es impar"
    FinSi
FinAlgoritmo
```

**3. Si anidados** (una decisión dentro de otra)

```pseudocodigo
Algoritmo Calificacion
    Definir nota Como Real
    Leer nota
    Si nota >= 90 Entonces
        Escribir "Excelente"
    SiNo
        Si nota >= 70 Entonces
            Escribir "Aprobado"
        SiNo
            Escribir "Reprobado"
        FinSi
    FinSi
FinAlgoritmo
```

**4. Segun** (cuando una variable tiene varias opciones fijas)

```pseudocodigo
Algoritmo Menu
    Definir opcion Como Entero
    Escribir "1) Saludar  2) Despedirse"
    Leer opcion
    Segun opcion Hacer
        1:
            Escribir "¡Hola!"
        2:
            Escribir "¡Adiós!"
        De Otro Modo:
            Escribir "Opción no válida"
    FinSegun
FinAlgoritmo
```

En el diagrama de flujo, cada `Si` es un **rombo** con dos salidas: Verdadero y Falso.

**Práctica en clase:**
1. Mayor de tres números.
2. Tarifa del bus: menores de 12 y mayores de 65 pagan la mitad.
3. Calculadora con menú (suma, resta, multiplicación, división; avisar si se divide entre 0).
$md$),

('LOG-1', 4, 'Ciclos: Mientras, Repetir y Para', $md$
**Objetivo:** repetir pasos sin escribirlos muchas veces.

**1. Contadores y acumuladores**
- **Contador:** suma de a 1 (`cantidad <- cantidad + 1`).
- **Acumulador:** suma valores (`total <- total + precio`).
Siempre se inician antes del ciclo (normalmente en 0).

**2. Para** (cuando sé cuántas veces repetir)

```pseudocodigo
Algoritmo TablaDeMultiplicar
    Definir n, i Como Entero
    Escribir "¿Qué tabla querés?"
    Leer n
    Para i <- 1 Hasta 10 Hacer
        Escribir n, " x ", i, " = ", n * i
    FinPara
FinAlgoritmo
```

**3. Mientras** (repite mientras la condición sea verdadera; puede no ejecutarse nunca)

```pseudocodigo
Algoritmo SumarHastaCero
    Definir n, suma Como Entero
    suma <- 0
    Leer n
    Mientras n <> 0 Hacer
        suma <- suma + n
        Leer n
    FinMientras
    Escribir "La suma es ", suma
FinAlgoritmo
```

**4. Repetir … Hasta Que** (se ejecuta al menos una vez; ideal para validar datos)

```pseudocodigo
Algoritmo ValidarEdad
    Definir edad Como Entero
    Repetir
        Escribir "Edad (0 a 120):"
        Leer edad
    Hasta Que edad >= 0 Y edad <= 120
    Escribir "Edad registrada: ", edad
FinAlgoritmo
```

**Cuidado con los ciclos infinitos:** si la condición nunca cambia, el ciclo no termina. En el Laboratorio el botón **Detener** lo corta.

**Práctica en clase:**
1. Promedio de N notas (primero se pide cuántas).
2. Contar cuántos números pares hay entre 1 y 100.
3. Adivinar un número: el programa tiene un número fijo y da pistas "más alto" o "más bajo" hasta que se acierte.

**Examen II** al final de la clase.
$md$),

('LOG-1', 5, 'Prueba de escritorio y repaso integrador', $md$
**Objetivo:** comprobar que un algoritmo funciona antes de darlo por bueno, y juntar todo lo visto.

**1. Prueba de escritorio**
Es "ejecutar a mano" el algoritmo con una tabla: una columna por variable y una fila por cada paso donde algo cambia.

```pseudocodigo
Algoritmo Factorial
    Definir n, i, f Como Entero
    Leer n
    f <- 1
    Para i <- 1 Hasta n Hacer
        f <- f * i
    FinPara
    Escribir n, "! = ", f
FinAlgoritmo
```

Con n = 4:

| Paso | n | i | f |
|---|---|---|---|
| Leer n | 4 | | |
| f <- 1 | 4 | | 1 |
| i = 1 | 4 | 1 | 1 |
| i = 2 | 4 | 2 | 2 |
| i = 3 | 4 | 3 | 6 |
| i = 4 | 4 | 4 | 24 |

Salida: `4! = 24`. En el Laboratorio, el botón **Paso a paso** arma esta tabla solo: primero hacela a mano y después comparala.

**2. Pruebas con varios datos**
No alcanza con un caso: probá un caso normal, uno en el borde (0, 1, el número más grande permitido) y uno inválido. En el Laboratorio, la pestaña **Pruebas** guarda entradas y salidas esperadas y marca ✓ o ✗.

**3. Repaso integrador** (en clase)
Cajero simple: saldo inicial 50 000; menú con consultar, depositar, retirar (sin dejar retirar más de lo que hay) y salir. Usa Segun, Si y un ciclo Repetir.

**4. Proyecto del curso**
Se explica el proyecto "Algoritmos resueltos" (ver Evaluación).

**Examen III** al final de la clase.
$md$),

-- =============================== LOG-2 =======================================
('LOG-2', 1, 'Descomposición de problemas', $md$
**Objetivo:** dividir un problema grande en partes pequeñas que se puedan resolver una por una.

**1. Divide y vencerás**
Un problema grande asusta; varias partes pequeñas no. Pasos:
1. Entender el problema: ¿qué entra, qué sale? (repaso de LOG-1).
2. Partirlo en tareas: cada una hace **una sola cosa**.
3. Ordenar las tareas.
4. Resolver cada una por separado y juntar.

**2. Ejemplo: tienda con descuento**
"Leer la cantidad y el precio de 3 productos, calcular el subtotal; si pasa de 20 000, aplicar 10 % de descuento; mostrar el total con IVA."

Partes:
- Leer los productos y calcular el subtotal.
- Calcular el descuento.
- Calcular el IVA.
- Mostrar el recibo.

**3. Refinamiento paso a paso**
Se escribe primero la versión "gruesa" (los nombres de las partes) y después se detalla cada parte. Así no se pierde la idea general.

```pseudocodigo
Algoritmo Tienda
    Definir i, cantidad Como Entero
    Definir precio, subtotal, descuento, total Como Real
    subtotal <- 0
    Para i <- 1 Hasta 3 Hacer
        Escribir "Cantidad y precio del producto ", i
        Leer cantidad, precio
        subtotal <- subtotal + cantidad * precio
    FinPara
    descuento <- 0
    Si subtotal > 20000 Entonces
        descuento <- subtotal * 0.10
    FinSi
    total <- (subtotal - descuento) * 1.13
    Escribir "Subtotal: ", subtotal
    Escribir "Descuento: ", descuento
    Escribir "Total con IVA: ", total
FinAlgoritmo
```

**Práctica en clase:** descomponer (sin programar todavía) un sistema de notas: leer las notas de 5 estudiantes, mostrar el promedio del grupo, la nota más alta y cuántos aprobaron.
$md$),

('LOG-2', 2, 'Funciones y parámetros', $md$
**Objetivo:** convertir cada parte del problema en una función reutilizable.

**1. ¿Qué es una función?**
Un bloque con nombre que recibe datos (**parámetros**), hace algo y devuelve un resultado. Se escribe una vez y se usa muchas.

```pseudocodigo
Funcion resultado <- Cuadrado(x)
    resultado <- x * x
FinFuncion

Algoritmo UsarFunciones
    Escribir Cuadrado(5)
    Escribir Cuadrado(3) + Cuadrado(4)
FinAlgoritmo
```

**2. SubProceso** (no devuelve nada, solo hace algo)

```pseudocodigo
SubProceso Linea(n)
    Definir i Como Entero
    Para i <- 1 Hasta n Hacer
        Escribir "-" Sin Saltar
    FinPara
    Escribir ""
FinSubProceso

Algoritmo Recibo
    Linea(20)
    Escribir "  FEN ACADEMY"
    Linea(20)
FinAlgoritmo
```

**3. Por valor y por referencia**
- Por valor (normal): la función recibe una **copia**; si la cambia, el original no cambia.
- `Por Referencia`: la función puede cambiar la variable original.

```pseudocodigo
SubProceso Intercambiar(a Por Referencia, b Por Referencia)
    Definir aux Como Entero
    aux <- a
    a <- b
    b <- aux
FinSubProceso

Algoritmo Prueba
    Definir x, y Como Entero
    x <- 1
    y <- 2
    Intercambiar(x, y)
    Escribir x, " ", y
FinAlgoritmo
```

**4. Buenas funciones**
- Hacen una sola cosa y su nombre lo dice (`CalcularIVA`, `EsPar`).
- No leen ni escriben si no hace falta: reciben parámetros y devuelven.

**Práctica en clase:** reescribir la tienda de la clase 1 con las funciones `Subtotal`, `Descuento` e `IVA`.

**Examen I** al final de la clase.
$md$),

('LOG-2', 3, 'Arreglos', $md$
**Objetivo:** guardar muchos datos del mismo tipo en una sola variable y recorrerlos.

**1. ¿Qué es un arreglo?**
Una fila de cajas con un mismo nombre y un número (índice). En pseudocódigo el primer índice es **1**.

```pseudocodigo
Algoritmo Notas
    Definir notas Como Real
    Definir i Como Entero
    Dimension notas[5]
    Para i <- 1 Hasta 5 Hacer
        Escribir "Nota ", i, ":"
        Leer notas[i]
    FinPara
    Para i <- 1 Hasta 5 Hacer
        Escribir "Estudiante ", i, ": ", notas[i]
    FinPara
FinAlgoritmo
```

**2. Recorridos típicos**
- **Sumar / promediar:** acumulador dentro del Para.
- **Mayor y menor:** empezar con el primer elemento y comparar con los demás.
- **Contar:** cuántos cumplen una condición.
- **Buscar:** recorrer hasta encontrar el valor (y avisar si no está).

```pseudocodigo
Algoritmo Mayor
    Definir v, mayor, i Como Entero
    Dimension v[6]
    v[1] <- 4
    v[2] <- 9
    v[3] <- 2
    v[4] <- 15
    v[5] <- 7
    v[6] <- 11
    mayor <- v[1]
    Para i <- 2 Hasta 6 Hacer
        Si v[i] > mayor Entonces
            mayor <- v[i]
        FinSi
    FinPara
    Escribir "El mayor es ", mayor
FinAlgoritmo
```

**3. Error común: salirse del arreglo**
Si el arreglo tiene 5 casillas, `notas[6]` no existe. El Laboratorio marca la línea del error.

**Práctica en clase:** con un arreglo de 10 números: promedio, cuántos están por encima del promedio y buscar un número que escriba el usuario.

**Examen II** al final de la clase.
$md$),

('LOG-2', 4, 'Casos de prueba, casos límite y ejercicios paso a paso', $md$
**Objetivo:** demostrar que una solución funciona en todos los casos, no solo en el que se probó primero.

**1. Casos de prueba**
Un caso de prueba es: **entrada** + **salida esperada**. Se escriben **antes** de programar.

Ejemplo para `EsBisiesto(año)`:

| Entrada | Esperado | Por qué |
|---|---|---|
| 2024 | Verdadero | divisible entre 4 |
| 2023 | Falso | no divisible entre 4 |
| 1900 | Falso | divisible entre 100 pero no entre 400 |
| 2000 | Verdadero | divisible entre 400 |

**2. Casos límite**
Donde más se equivoca un algoritmo:
- El valor más chico y el más grande permitido (0, 1, 100).
- Listas vacías o de un solo elemento.
- Datos repetidos o iguales.
- Datos inválidos (negativos, división entre 0).

**3. En el Laboratorio**
La pestaña **Pruebas** guarda cada caso con su entrada y la salida esperada; **Probar** los corre todos y marca ✓ o ✗. Si uno falla, usá **Paso a paso** para ver en qué línea se separa de lo que esperabas.

**4. Ejercicios paso a paso** (en clase, resolviendo juntos)
1. Número primo: función `EsPrimo(n)` con sus casos (1, 2, 9, 13).
2. Invertir un número: 1234 → 4321, usando MOD y TRUNC.
3. Contar vocales de un texto con `Longitud` y `Subcadena`.

**5. Proyecto del curso**
Se explica el proyecto "Reto de lógica" (ver Evaluación).

**Examen III** al final de la clase.
$md$),

-- =============================== COMP-1 ======================================
('COMP-1', 1, 'Archivos, rutas e instalación de programas', $md$
**Objetivo:** ordenar el computador como herramienta de trabajo y entender dónde está cada archivo.

**1. Archivos y carpetas**
- Un **archivo** guarda información (un documento, una foto, un programa).
- Una **carpeta** agrupa archivos y otras carpetas, como un árbol.
- La **extensión** dice qué tipo de archivo es: `.txt`, `.pdf`, `.py`, `.html`, `.exe`.

Activar "mostrar extensiones":
- Windows: Explorador → Ver → Mostrar → Extensiones de nombre de archivo.
- Mac: Finder → Ajustes → Avanzado → Mostrar todas las extensiones.

**2. Rutas**
La ruta es la "dirección" de un archivo.
- **Absoluta** (desde el inicio del disco): `C:\Users\ana\Documentos\fen\notas.txt` en Windows, `/Users/ana/Documentos/fen/notas.txt` en Mac y Linux.
- **Relativa** (desde donde estoy): `fen/notas.txt`, `../fotos/perfil.png` (`..` = la carpeta de arriba).

Buenas prácticas para nombres: sin espacios ni tildes en proyectos de código (`mi-proyecto`, `tarea_1`).

**3. Instalar programas**
- Descargar **solo** de la página oficial.
- Leer cada pantalla del instalador (desmarcar programas extra).
- Saber dónde quedó instalado.

**4. Variables de entorno y PATH**
El PATH es la lista de carpetas donde el sistema busca programas cuando escribís un comando. Si un programa "no se reconoce" en la terminal, casi siempre es porque no está en el PATH.

**Práctica en clase:** crear la carpeta de trabajo del curso, encontrar su ruta absoluta y escribir tres rutas relativas entre sus subcarpetas.

**Examen I** al final de la clase.
$md$),

('COMP-1', 2, 'VS Code y organización del espacio de trabajo', $md$
**Objetivo:** dejar instalado y configurado el editor que vamos a usar en toda la carrera.

**1. Instalar VS Code**
Desde code.visualstudio.com (Windows, Mac o Linux). En Windows marcar "Agregar a PATH" y "Abrir con Code".

**2. Primeros pasos**
- **Abrir carpeta** (no archivos sueltos): Archivo → Abrir carpeta.
- Explorador de archivos a la izquierda, editor en el centro.
- Guardado automático: Archivo → Guardado automático.

**3. Extensiones recomendadas**
- Spanish Language Pack (si lo querés en español).
- Prettier (ordena el código).
- Live Server (para HTML, más adelante).
- Python (para PY-1).

**4. Atajos que se usan todos los días**

| Acción | Windows / Linux | Mac |
|---|---|---|
| Paleta de comandos | Ctrl + Shift + P | Cmd + Shift + P |
| Buscar archivo | Ctrl + P | Cmd + P |
| Terminal integrada | Ctrl + ñ o Ctrl + ` | Ctrl + ` |
| Comentar línea | Ctrl + / | Cmd + / |
| Duplicar línea | Shift + Alt + ↓ | Shift + Option + ↓ |
| Varios cursores | Alt + clic | Option + clic |

**5. Organización del espacio de trabajo**

```text
fen-academy/
├── COMP-1/
│   ├── tareas/
│   └── proyecto/
├── LOG-1/
└── LOG-2/
```

Una carpeta por curso, adentro `tareas` y `proyecto`. Nombres cortos, sin espacios.

**Práctica en clase:** instalar VS Code, las extensiones y abrir la carpeta `fen-academy` con la terminal integrada.

**Examen II** al final de la clase.
$md$),

('COMP-1', 3, 'La terminal', $md$
**Objetivo:** moverse y trabajar con archivos solo con comandos.

**1. ¿Qué es la terminal?**
Una ventana donde se escriben órdenes en lugar de hacer clic. Los programadores la usan para correr programas, instalar herramientas y usar Git.
- Windows: PowerShell (o la terminal de VS Code).
- Mac y Linux: Terminal (bash o zsh).

**2. Comandos básicos**

| Para… | Windows (PowerShell) | Mac / Linux |
|---|---|---|
| ¿Dónde estoy? | `pwd` | `pwd` |
| Ver contenido | `ls` | `ls` |
| Entrar a carpeta | `cd tareas` | `cd tareas` |
| Subir una carpeta | `cd ..` | `cd ..` |
| Crear carpeta | `mkdir nueva` | `mkdir nueva` |
| Crear archivo vacío | `ni notas.txt` | `touch notas.txt` |
| Copiar | `cp a.txt b.txt` | `cp a.txt b.txt` |
| Mover / renombrar | `mv a.txt docs/` | `mv a.txt docs/` |
| Borrar archivo | `rm a.txt` | `rm a.txt` |
| Limpiar pantalla | `cls` o `clear` | `clear` |

**Cuidado:** `rm` no manda a la papelera, borra directo.

**3. Trucos**
- **Tab** completa nombres de archivos y carpetas.
- **Flecha arriba** repite comandos anteriores.
- `code .` abre la carpeta actual en VS Code.

**Práctica en clase:** crear desde la terminal toda la estructura `fen-academy` de la clase 2, mover y renombrar archivos, y abrirla con `code .`.

**4. Proyecto del curso**
Se explica el proyecto "Entorno de trabajo" (ver Evaluación).

**Examen III** al final de la clase.
$md$)

) as v(codigo, orden, titulo, descripcion)
join public.cursos c on c.codigo = v.codigo
where not exists (select 1 from public.clases x where x.curso_id = c.id and x.titulo = v.titulo);

-- --------------------------------------------------- tareas y proyectos ---
insert into public.actividades (curso_id, clase_id, tipo, titulo, descripcion, valor, publicada)
select c.id,
       (select x.id from public.clases x where x.curso_id = c.id and x.titulo = v.clase order by x.id limit 1),
       'entrega', v.titulo, v.descripcion, v.valor, false
from (values

-- =============================== LOG-1 =======================================
('LOG-1', 'Variables, tipos de datos, operadores y diagramas de flujo', 'Tarea 1: entrada, proceso y salida', 10, $md$
Resolvé los 3 problemas. Para **cada uno** entregá:
- la tabla **entrada / proceso / salida**,
- el **pseudocódigo** (probado en el Laboratorio),
- el **diagrama de flujo** (foto clara del papel o draw.io).

**Problemas**
1. Área y perímetro de un rectángulo (se leen base y altura).
2. Convertir grados Celsius a Fahrenheit: `F = C * 9 / 5 + 32`.
3. Promedio de tres notas, mostrando el promedio con decimales.

**Cómo entregar:** un PDF o un .zip con los archivos `.psc` (botón Descargar del Laboratorio) y las imágenes de los diagramas.

**Se evalúa:** que funcione (40 %), diagrama correcto (30 %), nombres de variables claros (20 %), orden de la entrega (10 %).
$md$),

('LOG-1', 'Condiciones: Si, SiNo y Segun', 'Tarea 2: decisiones', 10, $md$
Resolvé en pseudocódigo (probado en el Laboratorio) y con diagrama de flujo:

1. Leer un número y decir si es positivo, negativo o cero.
2. Leer tres números y mostrarlos ordenados de menor a mayor.
3. Leer la nota (0 a 100) y mostrar la letra: A (90–100), B (80–89), C (70–79), D (menos de 70). Si la nota no está entre 0 y 100, avisar "Nota inválida".
4. Menú con `Segun`: 1) área de un círculo, 2) área de un triángulo, 3) salir.

En cada problema anotá **3 casos de prueba** (entrada y salida esperada); uno tiene que ser un caso límite (por ejemplo, la nota 90 o 89).

**Cómo entregar:** .zip con los `.psc` y los diagramas.
$md$),

('LOG-1', 'Ciclos: Mientras, Repetir y Para', 'Tarea 3: ciclos', 10, $md$
Resolvé en pseudocódigo (probado en el Laboratorio):

1. Mostrar los números del 1 al N y su suma.
2. Leer números hasta que se escriba 0 y mostrar cuántos fueron, la suma, el mayor y el menor.
3. Validar una contraseña numérica: pedirla hasta que sea 1234, con un máximo de 3 intentos. Mostrar "Bienvenido" o "Cuenta bloqueada".
4. Mostrar la tabla de multiplicar del 1 al 5 (un Para dentro de otro).

Para el problema 2 hacé la **prueba de escritorio a mano** con la entrada `5, 8, 3, 0` y compará con el botón **Paso a paso**.

**Cómo entregar:** .zip con los `.psc` y la foto de la prueba de escritorio.
$md$),

('LOG-1', 'Prueba de escritorio y repaso integrador', 'Proyecto: algoritmos resueltos', 30, $md$
Elegí **5 problemas** de la lista (o proponé uno propio con permiso del profesor) y resolvé cada uno con:
1. Tabla entrada / proceso / salida.
2. Pseudocódigo que corra sin errores en el Laboratorio.
3. Diagrama de flujo.
4. Prueba de escritorio con al menos un caso.
5. Tres casos de prueba cargados en la pestaña **Pruebas** (captura con los ✓).

**Lista de problemas**
- Calculadora de propinas con el porcentaje elegido por el usuario.
- Cajero automático (consultar, depositar, retirar, salir).
- Juego de adivinar el número con intentos limitados.
- Conversor de monedas con menú.
- Cálculo del salario con horas extra (más de 48 h se pagan al 150 %).
- Factura con varios productos, descuento e IVA.
- Número primo y lista de primos hasta N.

**Se evalúa:** funcionamiento (40 %), diagramas (20 %), pruebas (20 %), claridad del código (10 %), presentación en clase (10 %).

**Cómo entregar:** un .zip con una carpeta por problema.
$md$),

-- =============================== LOG-2 =======================================
('LOG-2', 'Descomposición de problemas', 'Tarea 1: descomponer antes de programar', 10, $md$
Elegí **dos** de estos sistemas y, para cada uno, entregá:
- la lista de partes (qué hace cada una, qué recibe y qué devuelve),
- el orden en que se ejecutan,
- el pseudocódigo completo.

**Sistemas**
1. Parqueo: entra la hora de entrada y salida; cobra 800 la primera hora y 500 cada hora o fracción extra.
2. Notas del grupo: notas de 5 estudiantes, promedio, la más alta y cuántos aprobaron.
3. Planilla: salario bruto, rebajas (10,67 %) y salario neto de 3 empleados.

**Cómo entregar:** un PDF con la descomposición y los `.psc`.
$md$),

('LOG-2', 'Funciones y parámetros', 'Tarea 2: funciones', 10, $md$
Escribí y probá en el Laboratorio estas funciones, cada una con un algoritmo principal que la use:

1. `EsPar(n)` → Verdadero o Falso.
2. `Mayor(a, b, c)` → el mayor de tres números.
3. `Potencia(base, exponente)` usando un ciclo (sin `^`).
4. `SubProceso Intercambiar(a Por Referencia, b Por Referencia)`.
5. Reescribir uno de los sistemas de la Tarea 1 usando funciones.

Para cada función, una tabla con **3 casos de prueba** (uno límite).

**Cómo entregar:** .zip con los `.psc`.
$md$),

('LOG-2', 'Arreglos', 'Tarea 3: arreglos', 10, $md$
Con un arreglo de 10 números (leídos o asignados) resolvé, en un solo algoritmo con funciones:

1. Mostrar el arreglo.
2. Suma y promedio.
3. Mayor, menor y en qué posición está cada uno.
4. Cuántos son pares.
5. Buscar un número que escriba el usuario y decir en qué posición está o "no está".
6. Mostrar el arreglo al revés.

**Extra (opcional):** ordenar el arreglo de menor a mayor.

**Cómo entregar:** el `.psc` y una captura de la pestaña **Pruebas** con al menos 3 casos.
$md$),

('LOG-2', 'Casos de prueba, casos límite y ejercicios paso a paso', 'Proyecto: reto de lógica', 30, $md$
Elegí **un** reto y resolvelo dividido en funciones:

- **Tienda:** inventario de 5 productos en arreglos (nombre, precio, cantidad); vender, reponer, ver el reporte y avisar si no hay existencias.
- **Banco:** 3 cuentas en arreglos; depositar, retirar, transferir entre cuentas y ver saldos, sin permitir saldos negativos.
- **Notas:** 5 estudiantes con 3 notas cada uno; promedio por estudiante, del grupo, quién aprobó y el mejor promedio.

**Entregar:**
1. Descomposición (partes, qué recibe y devuelve cada función).
2. Pseudocódigo completo funcionando en el Laboratorio.
3. Al menos **8 casos de prueba** documentados (entrada, esperado, obtenido), 3 de ellos límite.
4. Presentación corta en clase: explicar una función y un caso límite.

**Se evalúa:** funcionamiento (40 %), uso de funciones (20 %), casos de prueba (20 %), claridad (10 %), presentación (10 %).
$md$),

-- =============================== COMP-1 ======================================
('COMP-1', 'Archivos, rutas e instalación de programas', 'Tarea 1: carpetas y rutas', 10, $md$
1. Creá esta estructura en tu computador:

```text
fen-academy/
├── COMP-1/
│   ├── tareas/
│   └── proyecto/
├── LOG-1/
└── LOG-2/
```

2. Dentro de `COMP-1/tareas` creá un archivo `rutas.txt` con:
   - la ruta **absoluta** de `fen-academy`,
   - la ruta **relativa** de `LOG-1` vista desde `COMP-1/tareas`,
   - tres extensiones de archivo que conozcas y qué programa las abre.
3. Activá "mostrar extensiones" en tu sistema.

**Cómo entregar:** el archivo `rutas.txt` y una captura de la estructura con las extensiones visibles.
$md$),

('COMP-1', 'VS Code y organización del espacio de trabajo', 'Tarea 2: VS Code listo', 10, $md$
1. Instalá VS Code y las extensiones vistas en clase.
2. Abrí la carpeta `fen-academy` (Archivo → Abrir carpeta).
3. Activá el guardado automático.
4. Creá `COMP-1/tareas/atajos.md` con los **8 atajos** que más vas a usar y para qué sirve cada uno.
5. Abrí la terminal integrada y escribí `pwd`.

**Cómo entregar:** `atajos.md` y una captura de VS Code con la carpeta abierta, las extensiones y la terminal mostrando el resultado de `pwd`.
$md$),

('COMP-1', 'La terminal', 'Tarea 3: solo con la terminal', 10, $md$
Sin usar el mouse ni el explorador de archivos, solo comandos:

1. Entrá a `fen-academy/COMP-1/tareas`.
2. Creá la carpeta `practica-terminal` y entrá.
3. Creá `uno.txt`, `dos.txt` y `tres.txt`.
4. Creá la carpeta `respaldo` y copiá `uno.txt` adentro.
5. Renombrá `dos.txt` a `segundo.txt`.
6. Mové `tres.txt` a `respaldo`.
7. Borrá `segundo.txt`.
8. Mostrá el contenido con `ls` en las dos carpetas.

**Cómo entregar:** un archivo `comandos.txt` con todos los comandos en orden y una captura de la terminal al final.
$md$),

('COMP-1', 'La terminal', 'Proyecto: entorno de trabajo', 30, $md$
Dejá tu computador listo para toda la carrera y documentalo.

**Entregar:**
1. Estructura de carpetas `fen-academy` con una carpeta por curso del bloque 1 (captura).
2. VS Code configurado: extensiones, guardado automático y tema a tu gusto (captura).
3. **Guía de comandos propia** (`guia-terminal.md`): cada comando visto, para qué sirve y un ejemplo, en tu sistema operativo.
4. Un script corto (`crear-curso.ps1` en Windows o `crear-curso.sh` en Mac/Linux) que cree la carpeta de un curso nuevo con `tareas` y `proyecto` adentro.
5. Demostración en clase: crear desde la terminal la carpeta de un curso nuevo y abrirla con `code .`.

**Se evalúa:** estructura y orden (20 %), VS Code (20 %), guía de comandos (30 %), script (20 %), demostración (10 %).
$md$)

) as v(codigo, clase, titulo, valor, descripcion)
join public.cursos c on c.codigo = v.codigo
where not exists (select 1 from public.actividades a where a.curso_id = c.id and a.titulo = v.titulo);
