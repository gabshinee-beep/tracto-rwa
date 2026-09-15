// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title ITractoRWA
/// @notice Interfaz de declaraciones de Tracto RWA v0.1.0; lógica en TractoRWA.sol.
/// @dev assetId es el hash de un identificador externo opaco del registro; no prueba
///      identidad jurídica ni unicidad del activo real. evidenceHash permite
///      referenciar/comparar evidencia, sin acreditar autenticidad o validez ni
///      garantizar privacidad. No incluye identidad, tokens, transferencias,
///      oráculos ni validación jurídica; no crea, prueba ni transfiere derechos.
///      Ambas operaciones se limitan a un único owner/operador demo en TractoRWA,
///      sin acreditar autoridad jurídica ni resolver gobernanza
///      o compliance. Aquí no se implementan permisos, almacenamiento ni validaciones.
interface ITractoRWA {
    /// @notice Estado jurídico declarado para el registro en la demo.
    /// @dev Por decisión de diseño, Extinguished es final e irreversible para ese
    ///      registro; esta interfaz no aplica esa regla mediante lógica. Ante un error se usaría
    ///      un nuevo registro con clave distinta y referencia opcional de corrección.
    enum LegalStatus {
        Pending,
        Active,
        Suspended,
        Extinguished
    }

    /// @notice Evento del alta: initialStatus Pending y revision 1.
    /// @dev recordedAt procede del timestamp del bloque: fecha de publicación,
    ///      no del hecho jurídico externo. actor procede del caller.
    ///      correctsAssetId cero indica ausencia de referencia; la referencia opcional
    ///      solo declara intención de corrección en la demo, sin validar el vínculo,
    ///      sustituir ni reabrir el registro anterior.
    event AssetRegistered(
        bytes32 indexed assetId,
        LegalStatus initialStatus,
        bytes32 evidenceHash,
        bytes32 correctsAssetId,
        uint64 revision,
        uint64 recordedAt,
        address indexed actor
    );

    /// @notice Evento por cada cambio, incrementando la revisión.
    /// @dev recordedAt procede del timestamp del bloque: fecha de publicación,
    ///      no del hecho jurídico externo. actor procede del caller.
    event LegalStatusChanged(
        bytes32 indexed assetId,
        LegalStatus previousStatus,
        LegalStatus newStatus,
        bytes32 evidenceHash,
        uint64 revision,
        uint64 recordedAt,
        address indexed actor
    );

    /// @notice Declara el alta de un registro con clave única bytes32 assetId.
    /// @dev Pending, revisión 1 y AssetRegistered. TractoRWA implementa alta única,
    ///      revisiones consecutivas y eventos por cambio.
    ///      correctsAssetId es opcional (cero si ausente), con la semántica del evento.
    ///      Ni recordedAt ni actor se reciben como parámetros. Sin retorno numérico.
    function registerAsset(
        bytes32 assetId,
        bytes32 evidenceHash,
        bytes32 correctsAssetId
    ) external;

    /// @notice Declara un cambio en el estado jurídico comunicado para un activo.
    /// @dev Cada cambio incrementa la revisión y emite LegalStatusChanged en TractoRWA.
    ///      Extinguished es final e irreversible por diseño, sin lógica que lo aplique
    ///      en esta interfaz. La implementación demo permite cualquier estado distinto
    ///      desde un origen no extinguido; no es un modelo jurídico de transiciones.
    ///      Ni recordedAt ni actor se reciben como parámetros.
    function updateLegalStatus(
        bytes32 assetId,
        LegalStatus newStatus,
        bytes32 evidenceHash
    ) external;
}
