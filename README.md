# Tracto RWA 0.1.0 — implementación local de demo

Esta demo implementa un registro de declaraciones sobre un identificador externo y su estado jurídico simulado. `ITractoRWA.sol` define las firmas y eventos; `TractoRWA.sol` incorpora almacenamiento, un operador fijo y validaciones técnicas; `test/TractoRWA.js` comprueba el comportamiento en una red local efímera de Hardhat. La versión sigue siendo `0.1.0`, demo no publicada.

La interfaz no acredita identidad ni autoridad jurídica, no verifica documentos y no crea, prueba ni transfiere derechos sobre activos reales. No incluye tokens, transferencias, oráculos ni validación jurídica; tampoco resuelve gobernanza o compliance.

## Configuración existente

| Campo | Valor |
|---|---|
| Versión | `0.1.0` |
| Destino futuro | Ethereum Sepolia, `chainId 11155111` |
| Solidity | `0.8.26` exacta |
| EVM | `cancun` |
| Optimizador | Habilitado, `runs: 200` |
| Hardhat | `2.29.1` exacta |
| Hardhat Toolbox | `6.1.0` exacta |
| OpenZeppelin Contracts | `5.6.1` exacta; instalado, sin uso en esta implementación |
| Proxy | Sin proxy |

Sepolia es un destino futuro, no un despliegue realizado. No existen dirección, transacción ni hash de bytecode desplegado en Sepolia o mainnet que documentar. Las pruebas crean instancias locales efímeras con cuentas de prueba, sin wallets ni fondos reales. La compilación produce ABI y bytecode locales; no demuestra publicación en una red externa. Puede calcularse un hash del archivo fuente, por ejemplo SHA-256: identifica ese archivo y no debe confundirse con un hash del bytecode compilado o del bytecode de una instancia on-chain.

## Funciones y eventos

`contracts/ITractoRWA.sol` declara `enum LegalStatus { Pending, Active, Suspended, Extinguished }` y únicamente estas dos funciones, sin valores de retorno:

```solidity
function registerAsset(bytes32 assetId, bytes32 evidenceHash, bytes32 correctsAssetId) external;
function updateLegalStatus(bytes32 assetId, LegalStatus newStatus, bytes32 evidenceHash) external;
```

Los dos eventos declarados son:

```solidity
event AssetRegistered(
    bytes32 indexed assetId,
    LegalStatus initialStatus,
    bytes32 evidenceHash,
    bytes32 correctsAssetId,
    uint64 revision,
    uint64 recordedAt,
    address indexed actor
);

event LegalStatusChanged(
    bytes32 indexed assetId,
    LegalStatus previousStatus,
    LegalStatus newStatus,
    bytes32 evidenceHash,
    uint64 revision,
    uint64 recordedAt,
    address indexed actor
);
```

## Semántica de los campos

| Campo | Semántica en la demo |
|---|---|
| `assetId` | Clave única `bytes32`: hash de un identificador externo opaco del registro. No prueba identidad jurídica ni unicidad del activo real. |
| `evidenceHash` | Permite referenciar y comparar evidencia; no acredita autenticidad o validez y no garantiza privacidad. |
| `correctsAssetId` | Referencia opcional de corrección en el alta. Cero significa ausencia de referencia. Solo declara intención en la demo: no valida el vínculo, no sustituye ni reabre el registro anterior. |
| `initialStatus` | Estado inicial: `Pending`. |
| `previousStatus`, `newStatus` | Estado anterior y nuevo estado declarado para el registro. |
| `revision` | `uint64`: revisión inicial 1; cada cambio aceptado incrementa la revisión en 1. El valor 0 se reserva para inexistencia. |
| `recordedAt` | `uint64` en ambos eventos, procedente de `block.timestamp`. Es fecha de publicación, no fecha del hecho jurídico externo. El almacenamiento conserva la fecha de la última operación aceptada. |
| `actor` | `msg.sender`, el caller que publica, sin acreditar autoridad jurídica. Se incluye en los eventos. |

Ni `recordedAt` ni `actor` se reciben como parámetros. Solo `assetId` y `actor` están indexados en ambos eventos.

## Memoria, permisos y operaciones

Un mapping privado relaciona cada `bytes32 assetId` con un struct `Asset`: `status`, `evidenceHash`, `correctsAssetId`, `revision` y `recordedAt`. Revisión 0 indica que la clave no existe, sin un booleano adicional. `getAsset(bytes32 assetId)` permite a cualquiera leer el struct de un registro existente, incluso extinguido; revierte si no existe. Que el mapping sea privado no hace confidenciales los datos de una blockchain. El estado guarda la evidencia vigente; los eventos permiten observar las publicaciones anteriores.

El constructor fija `owner = msg.sender` como dirección pública e inmutable. `onlyOwner` restringe ambas escrituras a ese operador único de demo. No hay transferencia o renuncia de propiedad, roles ni proxy. Este permiso técnico no acredita autoridad jurídica ni resuelve gobernanza o compliance.

`registerAsset` rechaza clave cero, evidencia cero y claves ya registradas, incluso extinguidas. Guarda `Pending`, revisión 1 y fecha del bloque antes de emitir exactamente un `AssetRegistered`. La referencia `correctsAssetId` no se valida: puede ser cero, apuntar a una clave inexistente, a un registro no extinguido o incluso a la propia clave. No crea ni modifica el registro referido.

`updateLegalStatus` rechaza registros inexistentes, evidencia cero, cualquier modificación de un registro extinguido y repetir el estado actual. Un cambio aceptado conserva la referencia de corrección, actualiza estado y evidencia, incrementa la revisión y guarda la fecha del bloque antes de emitir exactamente un `LegalStatusChanged` con estado previo y nuevo. No permite cambiar solo la evidencia manteniendo el estado.

Por decisión de diseño, `Extinguished` es final e irreversible para ese registro, y la implementación ahora aplica esa regla. Si hubiera un error, la corrección se hace únicamente mediante un nuevo registro con clave distinta y referencia opcional. El original sigue consultable y no se sustituye ni reabre.

La convención técnica de esta demo permite **todos los cambios entre estados distintos cuyo origen no sea `Extinguished`**, incluidos retornos a `Pending`. No es un modelo jurídico aprobado de transiciones. Los valores fuera del enum no son estados válidos de la interfaz Solidity. Quedan pendientes un modelo jurídico de transiciones, actualización de evidencia sin cambio de estado, gobernanza, validación externa y compliance real.

Los rechazos usan errores personalizados: `Unauthorized`, `EmptyAssetId`, `EmptyEvidenceHash`, `AssetAlreadyRegistered(assetId)`, `AssetNotFound(assetId)`, `AssetExtinguished(assetId)` y `UnchangedStatus`. Una operación que revierte no deja cambios de estado ni eventos persistentes.

## Interfaz, implementación y pruebas

| Capa | Responsabilidad | Alcance de la comprobación |
|---|---|---|
| `contracts/ITractoRWA.sol` | Enum de cuatro estados, dos operaciones de escritura y dos eventos, sin cambios de ABI respecto de la interfaz acordada. | Compilación de firmas y tipos; por sí sola no ejecuta reglas. |
| `contracts/TractoRWA.sol` | Memoria, operador fijo, altas, cambios, errores y lecturas `owner()`/`getAsset()`. | Aplica reglas técnicas, no certifica hechos externos. |
| `test/TractoRWA.js` | 24 casos locales: campos/eventos, permisos, entradas vacías, duplicados, inexistencia, transiciones, revisiones, finalidad, referencias e independencia. | Ejecuta instancias efímeras y compara timestamps con el bloque del receipt; no prueba validez legal ni constituye una auditoría de seguridad. |

## Ejecutar con las dependencias existentes

Con las dependencias existentes, desde esta carpeta:

```bash
npm run compile
npm test
```

Ejecutar desde esta carpeta. `npm run compile` compila interfaz e implementación. `npm test` usa la red local predeterminada de Hardhat, sin seleccionar Sepolia ni mainnet. No es necesario instalar o actualizar dependencias para reproducirlo en este entorno.

Validación realizada: `npm test` compiló dos archivos Solidity para `cancun` y terminó con **24 passing**. Esta suite corresponde a la implementación actual. Comprueba reglas técnicas concretas y sus rechazos, sin demostrar seguridad exhaustiva o efectos jurídicos.

## Lista de verificación

Los puntos siguientes se contrastaron con interfaz, implementación y pruebas. Se distingue qué ejecuta el código y qué sigue siendo un límite de la demo:

- [x] Identificador opaco: código y pruebas exigen clave `bytes32` no cero y no repetida; no verifican cómo se calculó ni identidad jurídica o unicidad real.
- [x] Corrección opcional: pruebas con cero, referencia inexistente y referencia a registros existentes confirman que no se valida el vínculo ni se sustituye o reabre el original.
- [x] Fecha en ambos eventos: pruebas comparan `recordedAt` con el timestamp del bloque; la interpretación como publicación y no hecho jurídico externo es un límite documentado.
- [x] `Extinguished` final e irreversible: pruebas rechazan todos los estados de destino, mantienen el original consultable y permiten corrección con otra clave.
- [x] Límites de demo: documentación sin afirmar validez legal, autoridad jurídica, autenticidad de evidencia o privacidad; las pruebas técnicas no acreditan esas propiedades.

## Primera clase para Enzo y Gabriel

1. **Interfaz:** define qué se puede pedir y qué información comunica cada evento. No guarda datos ni decide permisos.
2. **Memoria:** el mapping funciona como un índice por clave; el struct conserva la ficha vigente y la revisión cuenta los cambios aceptados.
3. **Permisos y reglas:** el operador escribe; los errores detienen operaciones no permitidas. `Extinguished` cierra ese registro de manera definitiva.
4. **Pruebas:** una instancia local recibe llamadas y se comparan resultados esperados, incluso los rechazos. Pasar estos casos demuestra ese comportamiento técnico, no la verdad jurídica de lo registrado.
