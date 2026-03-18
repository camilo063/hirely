/**
 * Seed: 50+ preguntas técnicas iniciales para el banco de preguntas.
 * Ejecutar: npx tsx src/lib/db/seeds/preguntas-iniciales.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#')) {
      const i = t.indexOf('=');
      if (i > 0 && !process.env[t.substring(0, i)]) {
        process.env[t.substring(0, i)] = t.substring(i + 1);
      }
    }
  }
} catch { /* */ }

interface PreguntaSeed {
  categoria: string;
  subcategoria?: string;
  tipo: 'opcion_multiple' | 'verdadero_falso' | 'respuesta_abierta' | 'codigo';
  dificultad: 'basico' | 'intermedio' | 'avanzado' | 'experto';
  enunciado: string;
  opciones?: { id: string; texto: string; es_correcta: boolean }[];
  respuesta_correcta?: string;
  explicacion?: string;
  puntos: number;
  tiempo_estimado_segundos: number;
  tags: string[];
}

const preguntas: PreguntaSeed[] = [
  // ─── JavaScript (10) ───
  { categoria: 'JavaScript', subcategoria: 'Tipos', tipo: 'opcion_multiple', dificultad: 'basico', enunciado: '¿Cuál es el resultado de typeof null en JavaScript?', opciones: [{ id: 'a', texto: '"null"', es_correcta: false }, { id: 'b', texto: '"object"', es_correcta: true }, { id: 'c', texto: '"undefined"', es_correcta: false }, { id: 'd', texto: '"boolean"', es_correcta: false }], explicacion: 'Es un bug histórico de JS. typeof null retorna "object" por razones de compatibilidad.', puntos: 10, tiempo_estimado_segundos: 60, tags: ['junior', 'fundamentals'] },
  { categoria: 'JavaScript', subcategoria: 'Arrays', tipo: 'opcion_multiple', dificultad: 'basico', enunciado: '¿Qué método de array retorna un nuevo array con los elementos que pasan una condición?', opciones: [{ id: 'a', texto: '.map()', es_correcta: false }, { id: 'b', texto: '.filter()', es_correcta: true }, { id: 'c', texto: '.reduce()', es_correcta: false }, { id: 'd', texto: '.find()', es_correcta: false }], explicacion: 'filter() crea un nuevo array con todos los elementos que pasan la condición.', puntos: 10, tiempo_estimado_segundos: 60, tags: ['junior', 'arrays'] },
  { categoria: 'JavaScript', subcategoria: 'Scope', tipo: 'verdadero_falso', dificultad: 'basico', enunciado: 'En JavaScript, las variables declaradas con "let" tienen scope de bloque.', respuesta_correcta: 'verdadero', explicacion: 'let y const tienen scope de bloque, a diferencia de var que tiene scope de función.', puntos: 10, tiempo_estimado_segundos: 45, tags: ['junior', 'scope'] },
  { categoria: 'JavaScript', subcategoria: 'Closures', tipo: 'opcion_multiple', dificultad: 'intermedio', enunciado: '¿Qué es un closure en JavaScript?', opciones: [{ id: 'a', texto: 'Una función que se auto-ejecuta', es_correcta: false }, { id: 'b', texto: 'Una función que tiene acceso a variables de su scope exterior', es_correcta: true }, { id: 'c', texto: 'Un tipo de loop', es_correcta: false }, { id: 'd', texto: 'Un método de String', es_correcta: false }], explicacion: 'Un closure es una función junto con su entorno léxico, permitiéndole acceder a variables del scope donde fue creada.', puntos: 10, tiempo_estimado_segundos: 90, tags: ['mid', 'closures'] },
  { categoria: 'JavaScript', subcategoria: 'Promesas', tipo: 'opcion_multiple', dificultad: 'intermedio', enunciado: '¿Cuál es la diferencia principal entre Promise.all() y Promise.allSettled()?', opciones: [{ id: 'a', texto: 'No hay diferencia', es_correcta: false }, { id: 'b', texto: 'Promise.all() falla si alguna promesa falla; allSettled() espera a todas', es_correcta: true }, { id: 'c', texto: 'Promise.allSettled() es más rápido', es_correcta: false }, { id: 'd', texto: 'Promise.all() solo acepta 2 promesas', es_correcta: false }], explicacion: 'Promise.all() rechaza con el primer error. Promise.allSettled() siempre resuelve con el estado de todas las promesas.', puntos: 10, tiempo_estimado_segundos: 90, tags: ['mid', 'async'] },
  { categoria: 'JavaScript', subcategoria: 'Prototipos', tipo: 'respuesta_abierta', dificultad: 'intermedio', enunciado: 'Explica la cadena de prototipos (prototype chain) en JavaScript y cómo se relaciona con la herencia.', respuesta_correcta: 'Cada objeto en JS tiene un prototipo interno [[Prototype]] que apunta a otro objeto. Cuando se busca una propiedad, JS sube por la cadena hasta encontrarla o llegar a null. Es el mecanismo de herencia en JS.', puntos: 15, tiempo_estimado_segundos: 180, tags: ['mid', 'prototypes'] },
  { categoria: 'JavaScript', subcategoria: 'Event Loop', tipo: 'opcion_multiple', dificultad: 'intermedio', enunciado: '¿En qué orden se ejecuta: console.log("1"); setTimeout(() => console.log("2"), 0); Promise.resolve().then(() => console.log("3"));?', opciones: [{ id: 'a', texto: '1, 2, 3', es_correcta: false }, { id: 'b', texto: '1, 3, 2', es_correcta: true }, { id: 'c', texto: '3, 1, 2', es_correcta: false }, { id: 'd', texto: '1, 2, 3 o 1, 3, 2 aleatoriamente', es_correcta: false }], explicacion: 'Microtasks (Promesas) se ejecutan antes que macrotasks (setTimeout), por eso 3 sale antes que 2.', puntos: 15, tiempo_estimado_segundos: 120, tags: ['mid', 'event-loop'] },
  { categoria: 'JavaScript', subcategoria: 'WeakMap', tipo: 'opcion_multiple', dificultad: 'avanzado', enunciado: '¿Cuál es la ventaja principal de usar WeakMap sobre Map para almacenar metadata de objetos?', opciones: [{ id: 'a', texto: 'WeakMap es más rápido', es_correcta: false }, { id: 'b', texto: 'Las claves de WeakMap permiten garbage collection cuando no hay otras referencias', es_correcta: true }, { id: 'c', texto: 'WeakMap acepta claves primitivas', es_correcta: false }, { id: 'd', texto: 'WeakMap tiene método .size', es_correcta: false }], explicacion: 'WeakMap mantiene referencias débiles a las claves, permitiendo que el GC las recolecte si no hay otras referencias.', puntos: 15, tiempo_estimado_segundos: 90, tags: ['senior', 'memory'] },
  { categoria: 'JavaScript', subcategoria: 'Generators', tipo: 'codigo', dificultad: 'avanzado', enunciado: 'Implementa una función generadora infinita que produzca la secuencia de Fibonacci.', respuesta_correcta: 'function* fibonacci() { let a = 0, b = 1; while(true) { yield a; [a, b] = [b, a + b]; } }', puntos: 20, tiempo_estimado_segundos: 300, tags: ['senior', 'generators'] },
  { categoria: 'JavaScript', subcategoria: 'Proxy', tipo: 'codigo', dificultad: 'avanzado', enunciado: 'Crea un Proxy que valide que todas las propiedades asignadas a un objeto sean strings no vacíos.', respuesta_correcta: 'const validator = new Proxy({}, { set(target, prop, value) { if (typeof value !== "string" || value.trim() === "") throw new TypeError("Valor debe ser string no vacío"); target[prop] = value; return true; } });', puntos: 20, tiempo_estimado_segundos: 300, tags: ['senior', 'proxy', 'metaprogramming'] },

  // ─── React (8) ───
  { categoria: 'React', subcategoria: 'Hooks', tipo: 'opcion_multiple', dificultad: 'basico', enunciado: '¿Cuál hook se usa para manejar estado local en un componente funcional?', opciones: [{ id: 'a', texto: 'useEffect', es_correcta: false }, { id: 'b', texto: 'useState', es_correcta: true }, { id: 'c', texto: 'useContext', es_correcta: false }, { id: 'd', texto: 'useRef', es_correcta: false }], explicacion: 'useState es el hook básico para manejar estado en componentes funcionales.', puntos: 10, tiempo_estimado_segundos: 45, tags: ['junior', 'hooks'] },
  { categoria: 'React', subcategoria: 'Rendering', tipo: 'verdadero_falso', dificultad: 'basico', enunciado: 'React re-renderiza un componente cada vez que su estado o props cambian.', respuesta_correcta: 'verdadero', explicacion: 'React re-renderiza cuando detecta cambios en state o props (por referencia para objetos).', puntos: 10, tiempo_estimado_segundos: 45, tags: ['junior', 'rendering'] },
  { categoria: 'React', subcategoria: 'useEffect', tipo: 'opcion_multiple', dificultad: 'intermedio', enunciado: '¿Qué sucede si no pasas el array de dependencias a useEffect?', opciones: [{ id: 'a', texto: 'Se ejecuta solo al montar', es_correcta: false }, { id: 'b', texto: 'Se ejecuta en cada render', es_correcta: true }, { id: 'c', texto: 'Nunca se ejecuta', es_correcta: false }, { id: 'd', texto: 'Da un error', es_correcta: false }], explicacion: 'Sin array de dependencias, useEffect se ejecuta después de cada render. Con [] solo al montar.', puntos: 10, tiempo_estimado_segundos: 60, tags: ['mid', 'hooks'] },
  { categoria: 'React', subcategoria: 'Performance', tipo: 'opcion_multiple', dificultad: 'intermedio', enunciado: '¿Cuál es la diferencia entre useMemo y useCallback?', opciones: [{ id: 'a', texto: 'useMemo memoriza valores, useCallback memoriza funciones', es_correcta: true }, { id: 'b', texto: 'Son exactamente iguales', es_correcta: false }, { id: 'c', texto: 'useMemo es para efectos secundarios', es_correcta: false }, { id: 'd', texto: 'useCallback es más rápido', es_correcta: false }], explicacion: 'useMemo memoriza el resultado de una computación. useCallback memoriza la referencia de una función.', puntos: 10, tiempo_estimado_segundos: 90, tags: ['mid', 'performance'] },
  { categoria: 'React', subcategoria: 'State Management', tipo: 'respuesta_abierta', dificultad: 'intermedio', enunciado: '¿Cuándo usarías useReducer en lugar de useState? Da un ejemplo concreto.', respuesta_correcta: 'useReducer es preferible cuando el estado es complejo (múltiples sub-valores), las actualizaciones dependen del estado anterior, o cuando la lógica de actualización es compleja. Ejemplo: formulario con múltiples campos y validación cruzada.', puntos: 15, tiempo_estimado_segundos: 180, tags: ['mid', 'state'] },
  { categoria: 'React', subcategoria: 'Patterns', tipo: 'respuesta_abierta', dificultad: 'intermedio', enunciado: 'Explica el patrón de Compound Components en React y cuándo lo usarías.', respuesta_correcta: 'Compound Components es un patrón donde un componente padre comparte estado implícitamente con sus hijos. Se usa para APIs más flexibles, como <Select><Option>. Los hijos acceden al estado del padre vía Context.', puntos: 15, tiempo_estimado_segundos: 180, tags: ['mid', 'patterns'] },
  { categoria: 'React', subcategoria: 'Server Components', tipo: 'opcion_multiple', dificultad: 'avanzado', enunciado: '¿Cuál es la principal limitación de los React Server Components (RSC)?', opciones: [{ id: 'a', texto: 'No pueden usar CSS', es_correcta: false }, { id: 'b', texto: 'No pueden usar hooks de estado ni eventos del navegador', es_correcta: true }, { id: 'c', texto: 'No pueden hacer fetch de datos', es_correcta: false }, { id: 'd', texto: 'Solo funcionan con TypeScript', es_correcta: false }], explicacion: 'Los RSC se renderizan en el servidor y no tienen acceso a APIs del navegador, hooks como useState/useEffect, ni event handlers.', puntos: 15, tiempo_estimado_segundos: 90, tags: ['senior', 'rsc', 'nextjs'] },
  { categoria: 'React', subcategoria: 'Concurrency', tipo: 'codigo', dificultad: 'avanzado', enunciado: 'Implementa un hook personalizado useDebounce(value, delay) que retorne el valor debounced.', respuesta_correcta: 'function useDebounce(value, delay) { const [debounced, setDebounced] = useState(value); useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [value, delay]); return debounced; }', puntos: 20, tiempo_estimado_segundos: 240, tags: ['senior', 'custom-hooks'] },

  // ─── TypeScript (6) ───
  { categoria: 'TypeScript', subcategoria: 'Tipos básicos', tipo: 'opcion_multiple', dificultad: 'basico', enunciado: '¿Cuál es la diferencia entre type e interface en TypeScript?', opciones: [{ id: 'a', texto: 'No hay diferencia', es_correcta: false }, { id: 'b', texto: 'interface puede extenderse, type puede crear uniones', es_correcta: true }, { id: 'c', texto: 'type es más rápido', es_correcta: false }, { id: 'd', texto: 'interface solo funciona con clases', es_correcta: false }], explicacion: 'Ambos son similares, pero interface soporta declaration merging y extends, mientras que type soporta uniones, intersecciones y tipos mapeados.', puntos: 10, tiempo_estimado_segundos: 60, tags: ['junior', 'types'] },
  { categoria: 'TypeScript', subcategoria: 'Generics', tipo: 'verdadero_falso', dificultad: 'basico', enunciado: 'Los generics en TypeScript permiten crear componentes que funcionan con múltiples tipos.', respuesta_correcta: 'verdadero', explicacion: 'Los generics parametrizan tipos, permitiendo código reutilizable y type-safe.', puntos: 10, tiempo_estimado_segundos: 45, tags: ['junior', 'generics'] },
  { categoria: 'TypeScript', subcategoria: 'Utility Types', tipo: 'opcion_multiple', dificultad: 'intermedio', enunciado: '¿Qué hace el utility type Partial<T> en TypeScript?', opciones: [{ id: 'a', texto: 'Hace todas las propiedades requeridas', es_correcta: false }, { id: 'b', texto: 'Hace todas las propiedades opcionales', es_correcta: true }, { id: 'c', texto: 'Elimina todas las propiedades', es_correcta: false }, { id: 'd', texto: 'Hace todas las propiedades readonly', es_correcta: false }], explicacion: 'Partial<T> convierte todas las propiedades de T en opcionales.', puntos: 10, tiempo_estimado_segundos: 60, tags: ['mid', 'utility-types'] },
  { categoria: 'TypeScript', subcategoria: 'Type Guards', tipo: 'respuesta_abierta', dificultad: 'intermedio', enunciado: 'Explica qué es un type guard en TypeScript y cuándo lo usarías. Da un ejemplo.', respuesta_correcta: 'Un type guard es una expresión que estrecha el tipo de una variable en tiempo de ejecución. Se usan para discriminar uniones. Ejemplo: function isString(x: unknown): x is string { return typeof x === "string"; }', puntos: 15, tiempo_estimado_segundos: 180, tags: ['mid', 'type-guards'] },
  { categoria: 'TypeScript', subcategoria: 'Mapped Types', tipo: 'codigo', dificultad: 'avanzado', enunciado: 'Crea un tipo DeepReadonly<T> que haga todas las propiedades (incluyendo anidadas) readonly.', respuesta_correcta: 'type DeepReadonly<T> = { readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K]; };', puntos: 20, tiempo_estimado_segundos: 300, tags: ['senior', 'mapped-types'] },
  { categoria: 'TypeScript', subcategoria: 'Conditional Types', tipo: 'codigo', dificultad: 'avanzado', enunciado: 'Implementa un tipo ExtractArrayType<T> que extraiga el tipo de los elementos de un array. Ejemplo: ExtractArrayType<string[]> = string.', respuesta_correcta: 'type ExtractArrayType<T> = T extends (infer U)[] ? U : never;', puntos: 20, tiempo_estimado_segundos: 240, tags: ['senior', 'conditional-types'] },

  // ─── SQL/Bases de Datos (6) ───
  { categoria: 'SQL', subcategoria: 'JOINs', tipo: 'opcion_multiple', dificultad: 'basico', enunciado: '¿Qué tipo de JOIN retorna solo las filas que tienen coincidencia en ambas tablas?', opciones: [{ id: 'a', texto: 'LEFT JOIN', es_correcta: false }, { id: 'b', texto: 'INNER JOIN', es_correcta: true }, { id: 'c', texto: 'FULL JOIN', es_correcta: false }, { id: 'd', texto: 'CROSS JOIN', es_correcta: false }], explicacion: 'INNER JOIN retorna solo filas con coincidencia en ambas tablas.', puntos: 10, tiempo_estimado_segundos: 45, tags: ['junior', 'joins'] },
  { categoria: 'SQL', subcategoria: 'Índices', tipo: 'verdadero_falso', dificultad: 'basico', enunciado: 'Un índice en una tabla de base de datos siempre mejora el rendimiento de las consultas SELECT.', respuesta_correcta: 'falso', explicacion: 'Los índices mejoran las lecturas pero ralentizan las escrituras. Además, no son útiles para consultas que leen la mayor parte de la tabla.', puntos: 10, tiempo_estimado_segundos: 60, tags: ['junior', 'indexes'] },
  { categoria: 'SQL', subcategoria: 'Window Functions', tipo: 'opcion_multiple', dificultad: 'intermedio', enunciado: '¿Qué función de ventana usarías para obtener el ranking de salarios por departamento sin gaps?', opciones: [{ id: 'a', texto: 'ROW_NUMBER()', es_correcta: false }, { id: 'b', texto: 'RANK()', es_correcta: false }, { id: 'c', texto: 'DENSE_RANK()', es_correcta: true }, { id: 'd', texto: 'NTILE()', es_correcta: false }], explicacion: 'DENSE_RANK() asigna ranking sin gaps. RANK() deja gaps. ROW_NUMBER() es secuencial sin empates.', puntos: 10, tiempo_estimado_segundos: 90, tags: ['mid', 'window-functions'] },
  { categoria: 'SQL', subcategoria: 'Normalización', tipo: 'respuesta_abierta', dificultad: 'intermedio', enunciado: 'Explica las tres primeras formas normales (1NF, 2NF, 3NF) con ejemplos breves.', respuesta_correcta: '1NF: valores atómicos, sin grupos repetidos. 2NF: cumple 1NF + no tiene dependencias parciales de la PK. 3NF: cumple 2NF + no tiene dependencias transitivas.', puntos: 15, tiempo_estimado_segundos: 240, tags: ['mid', 'normalization'] },
  { categoria: 'SQL', subcategoria: 'Optimización', tipo: 'respuesta_abierta', dificultad: 'avanzado', enunciado: '¿Qué es un query plan (EXPLAIN) y cómo lo usarías para optimizar una consulta lenta?', respuesta_correcta: 'EXPLAIN muestra cómo el motor ejecutará la consulta: qué índices usa, joins, scans. Se analiza buscando Seq Scan en tablas grandes, Nested Loop costosos, y se optimiza agregando índices, reescribiendo JOINs, o usando CTEs.', puntos: 20, tiempo_estimado_segundos: 240, tags: ['senior', 'optimization'] },
  { categoria: 'SQL', subcategoria: 'Transacciones', tipo: 'opcion_multiple', dificultad: 'avanzado', enunciado: '¿Qué nivel de aislamiento de transacción previene phantom reads?', opciones: [{ id: 'a', texto: 'READ COMMITTED', es_correcta: false }, { id: 'b', texto: 'REPEATABLE READ', es_correcta: false }, { id: 'c', texto: 'SERIALIZABLE', es_correcta: true }, { id: 'd', texto: 'READ UNCOMMITTED', es_correcta: false }], explicacion: 'Solo SERIALIZABLE previene phantom reads completamente. REPEATABLE READ previene non-repeatable reads pero no phantom reads (en el estándar SQL).', puntos: 15, tiempo_estimado_segundos: 90, tags: ['senior', 'transactions'] },

  // ─── Node.js/Backend (5) ───
  { categoria: 'Node.js', subcategoria: 'Event Loop', tipo: 'opcion_multiple', dificultad: 'basico', enunciado: '¿Por qué Node.js es eficiente para operaciones I/O?', opciones: [{ id: 'a', texto: 'Usa múltiples threads para cada request', es_correcta: false }, { id: 'b', texto: 'Usa un modelo event-driven no bloqueante con un solo thread principal', es_correcta: true }, { id: 'c', texto: 'Compila a código nativo', es_correcta: false }, { id: 'd', texto: 'Usa más RAM', es_correcta: false }], explicacion: 'Node.js usa un event loop single-threaded con I/O asíncrono, delegando operaciones bloqueantes al thread pool de libuv.', puntos: 10, tiempo_estimado_segundos: 60, tags: ['junior', 'fundamentals'] },
  { categoria: 'Node.js', subcategoria: 'Streams', tipo: 'verdadero_falso', dificultad: 'basico', enunciado: 'Los Streams en Node.js permiten procesar datos pieza por pieza sin cargar todo en memoria.', respuesta_correcta: 'verdadero', explicacion: 'Los Streams procesan datos en chunks, ideal para archivos grandes o datos en tiempo real.', puntos: 10, tiempo_estimado_segundos: 45, tags: ['junior', 'streams'] },
  { categoria: 'Node.js', subcategoria: 'Middleware', tipo: 'respuesta_abierta', dificultad: 'intermedio', enunciado: 'Explica el patrón middleware en Express/Node.js. ¿Cómo funciona la cadena de middleware?', respuesta_correcta: 'Los middleware son funciones que reciben req, res, next. Forman una cadena: cada uno puede modificar req/res, terminar la respuesta, o llamar next() para pasar al siguiente. Se ejecutan en orden de declaración.', puntos: 15, tiempo_estimado_segundos: 180, tags: ['mid', 'express'] },
  { categoria: 'Node.js', subcategoria: 'Seguridad', tipo: 'opcion_multiple', dificultad: 'intermedio', enunciado: '¿Cuál es la mejor práctica para manejar variables sensibles (API keys, passwords) en Node.js?', opciones: [{ id: 'a', texto: 'Hardcodearlas en el código', es_correcta: false }, { id: 'b', texto: 'Usar variables de entorno (.env) + nunca commitear al repositorio', es_correcta: true }, { id: 'c', texto: 'Guardarlas en un JSON público', es_correcta: false }, { id: 'd', texto: 'Encriptarlas en el código fuente', es_correcta: false }], explicacion: 'Variables de entorno con .env (excluido de git) es el estándar. En producción, usar secretos del cloud provider.', puntos: 10, tiempo_estimado_segundos: 60, tags: ['mid', 'security'] },
  { categoria: 'Node.js', subcategoria: 'Clustering', tipo: 'respuesta_abierta', dificultad: 'avanzado', enunciado: '¿Cómo escalarías una aplicación Node.js para aprovechar múltiples cores de CPU?', respuesta_correcta: 'Usar el módulo cluster nativo o PM2 en modo cluster para crear worker processes (uno por core). También se puede usar Docker con múltiples contenedores detrás de un load balancer como Nginx.', puntos: 20, tiempo_estimado_segundos: 240, tags: ['senior', 'scaling'] },

  // ─── Lógica y Algoritmos (5) ───
  { categoria: 'Lógica', subcategoria: 'Complejidad', tipo: 'opcion_multiple', dificultad: 'basico', enunciado: '¿Cuál es la complejidad temporal de buscar un elemento en un array no ordenado?', opciones: [{ id: 'a', texto: 'O(1)', es_correcta: false }, { id: 'b', texto: 'O(log n)', es_correcta: false }, { id: 'c', texto: 'O(n)', es_correcta: true }, { id: 'd', texto: 'O(n²)', es_correcta: false }], explicacion: 'En el peor caso hay que revisar todos los n elementos. Búsqueda lineal es O(n).', puntos: 10, tiempo_estimado_segundos: 45, tags: ['junior', 'complexity'] },
  { categoria: 'Lógica', subcategoria: 'Estructuras', tipo: 'opcion_multiple', dificultad: 'basico', enunciado: '¿Qué estructura de datos sigue el principio LIFO (Last In, First Out)?', opciones: [{ id: 'a', texto: 'Queue', es_correcta: false }, { id: 'b', texto: 'Stack', es_correcta: true }, { id: 'c', texto: 'Linked List', es_correcta: false }, { id: 'd', texto: 'Tree', es_correcta: false }], explicacion: 'Stack (pila) es LIFO: el último elemento agregado es el primero en salir.', puntos: 10, tiempo_estimado_segundos: 45, tags: ['junior', 'data-structures'] },
  { categoria: 'Lógica', subcategoria: 'Algoritmos', tipo: 'codigo', dificultad: 'intermedio', enunciado: 'Escribe una función que determine si un string es un palíndromo (ignora mayúsculas y espacios).', respuesta_correcta: 'function isPalindrome(str) { const clean = str.toLowerCase().replace(/[^a-z0-9]/g, ""); return clean === clean.split("").reverse().join(""); }', puntos: 15, tiempo_estimado_segundos: 180, tags: ['mid', 'strings'] },
  { categoria: 'Lógica', subcategoria: 'Recursión', tipo: 'codigo', dificultad: 'intermedio', enunciado: 'Implementa una función que aplane un array anidado de profundidad arbitraria. Ejemplo: flatten([1, [2, [3, [4]]]]) → [1, 2, 3, 4]', respuesta_correcta: 'function flatten(arr) { return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val), []); }', puntos: 15, tiempo_estimado_segundos: 240, tags: ['mid', 'recursion'] },
  { categoria: 'Lógica', subcategoria: 'Algoritmos', tipo: 'codigo', dificultad: 'avanzado', enunciado: 'Implementa una función que encuentre los dos números en un array que sumen un target dado. Complejidad O(n).', respuesta_correcta: 'function twoSum(nums, target) { const map = new Map(); for (let i = 0; i < nums.length; i++) { const complement = target - nums[i]; if (map.has(complement)) return [map.get(complement), i]; map.set(nums[i], i); } return []; }', puntos: 20, tiempo_estimado_segundos: 300, tags: ['senior', 'hash-map'] },

  // ─── Cultura y Soft Skills (5) ───
  { categoria: 'Soft Skills', subcategoria: 'Trabajo en equipo', tipo: 'respuesta_abierta', dificultad: 'basico', enunciado: 'Describe una situación donde tuviste un desacuerdo técnico con un compañero. ¿Cómo lo resolviste?', respuesta_correcta: 'Buscar respuestas que muestren: comunicación asertiva, disposición a escuchar, argumentación basada en datos, y capacidad de llegar a consenso.', puntos: 10, tiempo_estimado_segundos: 300, tags: ['culture', 'teamwork'] },
  { categoria: 'Soft Skills', subcategoria: 'Liderazgo', tipo: 'respuesta_abierta', dificultad: 'basico', enunciado: '¿Cómo manejarías una situación donde un proyecto está retrasado y el equipo está desmotivado?', respuesta_correcta: 'Buscar: identificar causa raíz, comunicación transparente con stakeholders, repriorización, reconocer el trabajo del equipo, acciones concretas de mejora.', puntos: 10, tiempo_estimado_segundos: 300, tags: ['culture', 'leadership'] },
  { categoria: 'Soft Skills', subcategoria: 'Comunicación', tipo: 'respuesta_abierta', dificultad: 'basico', enunciado: '¿Cómo explicarías un concepto técnico complejo a un stakeholder no técnico?', respuesta_correcta: 'Buscar: uso de analogías, evitar jerga técnica, enfocarse en el impacto de negocio, uso de visualizaciones, verificar comprensión.', puntos: 10, tiempo_estimado_segundos: 240, tags: ['culture', 'communication'] },
  { categoria: 'Soft Skills', subcategoria: 'Crecimiento', tipo: 'respuesta_abierta', dificultad: 'basico', enunciado: '¿Cuál fue el último concepto técnico nuevo que aprendiste y cómo lo aplicaste?', respuesta_correcta: 'Buscar: curiosidad intelectual, capacidad de auto-aprendizaje, aplicación práctica, compartir conocimiento.', puntos: 10, tiempo_estimado_segundos: 240, tags: ['culture', 'growth'] },
  { categoria: 'Soft Skills', subcategoria: 'Problem Solving', tipo: 'respuesta_abierta', dificultad: 'basico', enunciado: 'Describe tu proceso para debuggear un problema complejo en producción.', respuesta_correcta: 'Buscar: enfoque metódico (reproducir, aislar, diagnosticar), uso de logs/métricas, comunicación del status, documentar la solución, prevención futura.', puntos: 10, tiempo_estimado_segundos: 300, tags: ['culture', 'debugging'] },

  // ─── DevOps/Cloud (5) ───
  { categoria: 'DevOps', subcategoria: 'Docker', tipo: 'opcion_multiple', dificultad: 'basico', enunciado: '¿Qué es un contenedor Docker?', opciones: [{ id: 'a', texto: 'Una máquina virtual completa', es_correcta: false }, { id: 'b', texto: 'Un proceso aislado con su propio filesystem, red y recursos', es_correcta: true }, { id: 'c', texto: 'Un servidor dedicado', es_correcta: false }, { id: 'd', texto: 'Un tipo de base de datos', es_correcta: false }], explicacion: 'Un contenedor es un proceso aislado que comparte el kernel del host pero tiene su propio filesystem, network namespace y resources.', puntos: 10, tiempo_estimado_segundos: 60, tags: ['junior', 'docker'] },
  { categoria: 'DevOps', subcategoria: 'CI/CD', tipo: 'verdadero_falso', dificultad: 'basico', enunciado: 'CI/CD (Continuous Integration/Continuous Deployment) automatiza el proceso de testing y despliegue.', respuesta_correcta: 'verdadero', explicacion: 'CI automatiza el build y testing al integrar código. CD automatiza el despliegue a ambientes.', puntos: 10, tiempo_estimado_segundos: 45, tags: ['junior', 'cicd'] },
  { categoria: 'DevOps', subcategoria: 'Kubernetes', tipo: 'opcion_multiple', dificultad: 'intermedio', enunciado: '¿Cuál es la unidad mínima de despliegue en Kubernetes?', opciones: [{ id: 'a', texto: 'Container', es_correcta: false }, { id: 'b', texto: 'Pod', es_correcta: true }, { id: 'c', texto: 'Service', es_correcta: false }, { id: 'd', texto: 'Node', es_correcta: false }], explicacion: 'Un Pod es la unidad mínima en K8s. Puede contener uno o más contenedores que comparten red y storage.', puntos: 10, tiempo_estimado_segundos: 60, tags: ['mid', 'kubernetes'] },
  { categoria: 'DevOps', subcategoria: 'Infraestructura', tipo: 'respuesta_abierta', dificultad: 'intermedio', enunciado: '¿Qué es Infrastructure as Code (IaC) y qué beneficios tiene? Menciona una herramienta.', respuesta_correcta: 'IaC es gestionar infraestructura mediante código versionable en lugar de configuración manual. Beneficios: reproducibilidad, versionamiento, automatización, consistencia. Herramientas: Terraform, Pulumi, CloudFormation.', puntos: 15, tiempo_estimado_segundos: 180, tags: ['mid', 'iac'] },
  { categoria: 'DevOps', subcategoria: 'Observabilidad', tipo: 'respuesta_abierta', dificultad: 'avanzado', enunciado: 'Explica los tres pilares de la observabilidad y cómo los implementarías en una aplicación distribuida.', respuesta_correcta: 'Los tres pilares son: Logs (registro de eventos), Métricas (datos numéricos de rendimiento), y Trazas (seguimiento de requests entre servicios). Implementación: ELK/Loki para logs, Prometheus/Grafana para métricas, Jaeger/Zipkin para trazas distribuidas.', puntos: 20, tiempo_estimado_segundos: 300, tags: ['senior', 'observability'] },
];

async function seed() {
  const { pool } = await import('../../db');

  // Get org id
  const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
  if (orgResult.rows.length === 0) {
    console.error('No organization found. Run the main seed first.');
    process.exit(1);
  }
  const orgId = orgResult.rows[0].id;

  // Get a user for creado_por
  const userResult = await pool.query('SELECT id FROM users LIMIT 1');
  const userId = userResult.rows[0]?.id || null;

  console.log(`Seeding ${preguntas.length} preguntas for org ${orgId}...`);

  let inserted = 0;
  for (const p of preguntas) {
    try {
      await pool.query(
        `INSERT INTO preguntas_banco (
          organization_id, categoria, subcategoria, tipo, dificultad,
          enunciado, opciones, respuesta_correcta, explicacion,
          puntos, tiempo_estimado_segundos, tags, es_estandar,
          cargos_aplicables, idioma, estado, creado_por
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          orgId, p.categoria, p.subcategoria || null, p.tipo, p.dificultad,
          p.enunciado, p.opciones ? JSON.stringify(p.opciones) : null,
          p.respuesta_correcta || null, p.explicacion || null,
          p.puntos, p.tiempo_estimado_segundos,
          p.tags, true, // es_estandar = true
          [], 'es', 'activa', userId,
        ]
      );
      inserted++;
    } catch (err) {
      console.error(`Error inserting: ${p.enunciado.substring(0, 50)}...`, (err as Error).message);
    }
  }

  console.log(`\nInserted ${inserted}/${preguntas.length} preguntas.`);

  // Show category counts
  const cats = await pool.query(
    `SELECT categoria, COUNT(*)::int as total FROM preguntas_banco WHERE organization_id = $1 GROUP BY categoria ORDER BY total DESC`,
    [orgId]
  );
  console.log('\nPreguntas por categoría:');
  for (const row of cats.rows) {
    console.log(`  ${row.categoria}: ${row.total}`);
  }

  await pool.end();
  process.exit(0);
}

seed().catch(console.error);
