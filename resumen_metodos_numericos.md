# Base de Conocimiento: Métodos Numéricos

Este documento contiene un resumen detallado y estructurado de los principales métodos numéricos, diseñado especialmente para servir como base de conocimiento para un Agente de IA encargado de resolver problemas matemáticos e ingenieriles en una calculadora de métodos numéricos.

---

## 3. Raíces de Ecuaciones

### 3.1. Presentación del problema
En ingeniería, frecuentemente se requiere encontrar los valores de $x$ (raíces o ceros) para los cuales una función $f(x) = 0$. Esto es fundamental para encontrar nodos en sistemas de amortiguamiento, puntos de equilibrio, intersecciones de curvas, entre otros.

### 3.2. Método de Bisección
Es un método cerrado que se basa en el Teorema del Valor Intermedio. Si una función es continua en un intervalo $[a, b]$ y hay un cambio de signo ($f(a) \cdot f(b) < 0$), existe al menos una raíz en ese intervalo.
*   **Algoritmo**: 
    1. Se calcula el punto medio $c = (a+b)/2$.
    2. Se evalúa $f(c)$.
    3. Si $f(a) \cdot f(c) < 0$, la raíz está en $[a, c]$, entonces $b = c$.
    4. Si $f(a) \cdot f(c) > 0$, la raíz está en $[c, b]$, entonces $a = c$.
    5. Se repite hasta que el error sea menor a la tolerancia permitida.
*   **Ventajas**: Es 100% confiable (siempre converge si se cumplen las condiciones iniciales), fácil de programar y útil para acotar intervalos.
*   **Desventajas**: Convergencia muy lenta, no detecta raíces múltiples de orden par (donde la curva toca el eje pero no lo cruza).

### 3.3. Método de Punto Fijo
Es un método abierto que transforma la ecuación original $f(x) = 0$ en la forma $x = g(x)$. La raíz se encuentra en la intersección de la función identidad $y = x$ y la curva $y = g(x)$.
*   **Algoritmo**: Utiliza la fórmula iterativa $x_{i+1} = g(x_i)$.
*   **Condición de Convergencia**: Para que el método converja, la derivada de $g(x)$ evaluada en la cercanía de la raíz debe ser menor a 1 en valor absoluto: $|g'(x)| < 1$.
*   **Ventajas**: Rápida convergencia cuando se elige una $g(x)$ adecuada, fácil de programar.
*   **Desventajas**: Puede ser muy difícil encontrar una función $g(x)$ que garantice la convergencia; a menudo diverge si no se cumple la condición estricta.

### 3.4. Método de Newton-Raphson
Es el método más utilizado en ingeniería por su velocidad. Se deduce del truncamiento de la serie de Taylor de primer orden. Gráficamente, traza una recta tangente a la función en el punto actual $x_i$ y define el próximo punto $x_{i+1}$ donde esta tangente corta el eje X.
*   **Algoritmo**: $x_{i+1} = x_i - \frac{f(x_i)}{f'(x_i)}$
*   **Ventajas**: Convergencia cuadrática (muy rápida). Se considera un caso especial de Punto Fijo.
*   **Desventajas**: Requiere calcular analíticamente la derivada $f'(x)$, lo cual puede ser tedioso. Puede divergir si la derivada es cercana a cero (curvas planas) o si el valor inicial está muy lejos de la raíz.

### 3.5. Método de la Secante
Es una variante de Newton-Raphson diseñada para evitar el cálculo analítico de la derivada. Aproxima la derivada (recta tangente) utilizando una diferencia finita entre dos puntos (recta secante).
*   **Algoritmo**: $x_{i+1} = x_i - \frac{f(x_i)(x_{i-1} - x_i)}{f(x_{i-1}) - f(x_i)}$
*   **Ventajas**: No necesita la derivada analítica de la función. Mantiene una alta velocidad de convergencia (superlineal).
*   **Desventajas**: Requiere dos valores iniciales ($x_0$ y $x_{-1}$) para arrancar.

---

## 4. Sistemas de Ecuaciones Lineales

### 4.1. Presentación del problema
Consiste en resolver sistemas de la forma $A\vec{x} = \vec{b}$, donde $A$ es una matriz cuadrada de coeficientes, $\vec{x}$ es el vector de incógnitas y $\vec{b}$ es el vector de términos independientes. Aplicable en matrices de rigidez estructural, mallas de circuitos eléctricos (Leyes de Kirchhoff), etc.

### 4.2. Método de Eliminación Gaussiana
Es un método directo que consta de dos etapas principales operando sobre la matriz extendida (matriz $A$ con el vector $\vec{b}$ añadido como última columna).
*   **Triangulación**: Mediante operaciones elementales entre filas y el uso de multiplicadores $m_{ij} = \frac{a_{ij}}{a_{jj}}$, se reducen a cero todos los elementos por debajo de la diagonal principal, convirtiendo a $A$ en una matriz triangular superior.
*   **Sustitución hacia atrás**: Se despeja la última incógnita $x_n = \frac{b_n}{a_{nn}}$, y luego se van despejando las incógnitas anteriores sucesivamente: $x_i = \frac{b_i - \sum_{j=i+1}^{n} a_{ij}x_j}{a_{ii}}$.

### 4.3. Método de Gauss-Seidel
Es un método iterativo basado en el principio de punto fijo, optimizado a partir del método de Jacobi.
*   **Algoritmo**: Se despeja $x_i$ de cada ecuación $i$. En cada iteración, se calcula el nuevo valor de $x_i$ utilizando inmediatamente los valores más recientes calculados de las otras variables:
    $x_i^{(k+1)} = \frac{b_i - \sum_{j=1}^{i-1} a_{ij}x_j^{(k+1)} - \sum_{j=i+1}^{n} a_{ij}x_j^{(k)}}{a_{ii}}$
*   **Consideraciones**: Exige que no existan elementos nulos en la diagonal principal. Converge de forma segura si la matriz $A$ es diagonalmente dominante.

### 4.4. Método de LU
Este método factoriza la matriz original $A$ en el producto de dos matrices: $L$ (triangular inferior) y $U$ (triangular superior), tal que $A = L \cdot U$.
*   **Proceso**: 
    1. La matriz $U$ es simplemente la matriz resultante de aplicar la triangulación en la Eliminación Gaussiana.
    2. La matriz $L$ contiene números $1$ en su diagonal principal y los multiplicadores $m_{ij}$ usados en la eliminación gaussiana por debajo de la diagonal.
*   **Resolución**: Se resuelve el sistema $A\vec{x} = \vec{b}$ en dos pasos simples:
    1. Sustitución hacia adelante resolviendo $L\vec{y} = \vec{b}$.
    2. Sustitución hacia atrás resolviendo $U\vec{x} = \vec{y}$.
*   **Ventaja**: Es altamente eficiente cuando se debe resolver el sistema para múltiples vectores $\vec{b}$, ya que la factorización LU solo se realiza una vez.

---

## 5. Ajuste de Curvas

### 5.1. Presentación del problema
Cuando se trabaja con datos experimentales discretos (puntos aislados), se requiere encontrar una curva que represente la tendencia (Regresión) o que pase exactamente por todos los puntos (Interpolación).

### 5.2. Regresión Lineal (Mínimos Cuadrados)
Busca la línea recta $y = a_0 + a_1x$ que mejor aproxima un conjunto de pares ordenados, minimizando la suma de los cuadrados de los errores o residuos ($S_r = \sum (y_i - a_0 - a_1x_i)^2$).
*   **Cálculo**: Al derivar e igualar a cero, se obtiene un sistema de ecuaciones normales que define $a_1$ (pendiente) y $a_0$ (ordenada al origen).
*   **Modelos no lineales**: Muchos modelos pueden "linealizarse" mediante transformaciones (ej. logaritmos) para aplicar este método.
    *   *Exponencial* ($y = Ae^{Bx}$): Se ajusta usando $(x_i, \ln y_i)$.
    *   *Potencial* ($y = Ax^B$): Se ajusta usando $(\log x_i, \log y_i)$.
    *   *Razón de crecimiento* ($y = A \frac{x}{b+x}$): Se ajusta usando $(1/x_i, 1/y_i)$.

### 5.3. Polinomio de Newton (Diferencias Divididas)
Construye un polinomio de grado $n$ que pasa exactamente por $n+1$ puntos mediante el uso de diferencias divididas (aproximaciones de derivadas).
*   **Estructura**: $f_n(x) = f(x_0) + f[x_1,x_0](x-x_0) + f[x_2,x_1,x_0](x-x_0)(x-x_1) + \dots$
*   **Diferencias Divididas**: Se calculan recursivamente. Por ejemplo: $f[x_1,x_0] = \frac{f(x_1)-f(x_0)}{x_1-x_0}$.
*   **Ventaja**: Su estructura modular permite añadir nuevos puntos sin tener que recalcular todo desde cero.

### 5.4. Polinomio de Lagrange
Es una reformulación matemática del polinomio de Newton que evita el cálculo de las tablas de diferencias divididas, resultando en una expresión directa.
*   **Fórmula**: $f_n(x) = \sum_{i=0}^{n} L_i(x)f(x_i)$, donde $L_i(x) = \prod_{j \neq i} \frac{x - x_j}{x_i - x_j}$.
*   **Desventaja**: Para una gran cantidad de puntos, el grado del polinomio resultante es muy alto, lo que genera fuertes oscilaciones en los bordes del intervalo (Fenómeno de Runge).

### 5.5. Interpolación Segmentaria (Splines)
Para evitar el alto error oscilatorio de los polinomios de grado elevado, se utilizan polinomios de bajo grado (típicamente cúbicos) conectados entre cada par de puntos adyacentes.
*   **Trazadoras Cúbicas**: Cada segmento es un polinomio de tercer grado. Para garantizar suavidad en las uniones (nodos), se impone que las curvas compartan la misma imagen, primera derivada (pendiente) y segunda derivada (curvatura) en dichos nodos.
*   **Condiciones de borde**: Como faltan ecuaciones para resolver el sistema, se asumen valores en los bordes extremos del conjunto de datos:
    *   *Spline Natural*: La segunda derivada en los bordes es cero.
    *   *Spline Condicionado*: Se fuerza un valor específico de la primera derivada en los bordes.

---

## 6. Diferenciación Numérica

### 6.1. Presentación del problema
Permite aproximar el valor de la derivada de una función utilizando datos discretos, basándose en la definición de límite e implementándose numéricamente a través de expansiones de series de Taylor. 

*   **Diferencias de dos puntos (Error de truncamiento $O(h)$)**:
    *   *Hacia adelante (Progresiva)*: $f'(x_0) \approx \frac{f(x_0+h) - f(x_0)}{h}$
    *   *Hacia atrás (Regresiva)*: $f'(x_0) \approx \frac{f(x_0) - f(x_0-h)}{h}$
    *   *Centrada*: $f'(x_0) \approx \frac{f(x_0+h) - f(x_0-h)}{2h}$ (Esta variante mejora el error a $O(h^2)$).

### 6.2. Fórmulas de Tres Puntos
Se derivan expandiendo el polinomio de Taylor hasta la tercera derivada. Aumentan la precisión al involucrar un punto adicional, reduciendo el error de truncamiento al orden de $O(h^2)$.
*   Permiten calcular derivadas hacia adelante, hacia atrás y centradas más exactas. Son ideales cuando los datos están equiespaciados.

### 6.3. Fórmulas de Cinco Puntos
Llevan la expansión de Taylor aún más lejos (truncando términos de mayor orden). Al utilizar información de cinco nodos adyacentes, logran un error de truncamiento del orden de $O(h^4)$, brindando derivadas numéricas de altísima precisión. Su uso es crítico en cálculos donde un leve desvío en la derivada arrastraría errores masivos al sistema.

---

## 7. Integración Numérica

### 7.1. Presentación del problema
Busca aproximar el valor de la integral definida de una función $\int_{a}^{b} f(x) dx$ sumando áreas bajo curvas simples (polinomios) que se ajustan a puntos muestreados de la función real. Las fórmulas resultantes de usar polinomios interpolantes equiespaciados se conocen como Fórmulas de Newton-Cotes.

### 7.2. Regla de los Trapecios
Aproxima la función en el intervalo $[a, b]$ mediante una línea recta (polinomio de grado 1), calculando el área del trapecio formado.
*   **Fórmula Simple**: $I \approx (b-a) \frac{f(a) + f(b)}{2}$
*   **Fórmula Compuesta**: Se divide el intervalo total en $n$ subintervalos de tamaño $h$. El error decae cuadráticamente ($O(h^2)$).
*   **Uso**: Es robusta, pero requiere muchos intervalos pequeños para integrar con precisión funciones con gran curvatura.

### 7.3. Regla de Simpson
Mejoran notablemente la regla trapezoidal utilizando polinomios de interpolación de grado superior para conectar los puntos.
*   **Regla de Simpson 1/3**: Utiliza polinomios de segundo grado (parábolas) conectando grupos de 3 puntos (2 subintervalos). Su error es de orden $O(h^4)$.
    *   *Fórmula Simple*: $I \approx \frac{h}{3} [f(x_0) + 4f(x_1) + f(x_2)]$
*   **Regla de Simpson 3/8**: Utiliza polinomios de tercer grado conectando grupos de 4 puntos (3 subintervalos). Posee un error similar a 1/3 pero es útil cuando el número de segmentos en la aplicación compuesta requiere ser un múltiplo de 3.
    *   *Fórmula Simple*: $I \approx \frac{3h}{8} [f(x_0) + 3f(x_1) + 3f(x_2) + f(x_3)]$
