// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "./ITractoRWA.sol";

/// @notice Implementación local de la demo; no acredita derechos ni autoridad jurídica.
contract TractoRWA is ITractoRWA {
    struct Asset {
        LegalStatus status;
        bytes32 evidenceHash;
        bytes32 correctsAssetId;
        uint64 revision;
        uint64 recordedAt;
    }

    /// @notice Operador fijo de la demo, sin transferencia ni renuncia.
    address public immutable owner;
    // revision 0 indica inexistencia; los registros existentes empiezan en 1.
    mapping(bytes32 => Asset) private assets;

    error Unauthorized();
    error EmptyAssetId();
    error EmptyEvidenceHash();
    error AssetAlreadyRegistered(bytes32 assetId);
    error AssetNotFound(bytes32 assetId);
    error AssetExtinguished(bytes32 assetId);
    error UnchangedStatus();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /// @inheritdoc ITractoRWA
    function registerAsset(
        bytes32 assetId,
        bytes32 evidenceHash,
        bytes32 correctsAssetId
    ) external override onlyOwner {
        if (assetId == bytes32(0)) revert EmptyAssetId();
        if (evidenceHash == bytes32(0)) revert EmptyEvidenceHash();
        if (assets[assetId].revision != 0) revert AssetAlreadyRegistered(assetId);

        uint64 recordedAt = uint64(block.timestamp);
        // La referencia de corrección es declarativa: no se valida ni modifica su destino.
        assets[assetId] = Asset(LegalStatus.Pending, evidenceHash, correctsAssetId, 1, recordedAt);
        emit AssetRegistered(assetId, LegalStatus.Pending, evidenceHash, correctsAssetId, 1, recordedAt, msg.sender);
    }

    /// @inheritdoc ITractoRWA
    function updateLegalStatus(
        bytes32 assetId,
        LegalStatus newStatus,
        bytes32 evidenceHash
    ) external override onlyOwner {
        Asset storage asset = assets[assetId];
        if (asset.revision == 0) revert AssetNotFound(assetId);
        if (evidenceHash == bytes32(0)) revert EmptyEvidenceHash();
        if (asset.status == LegalStatus.Extinguished) revert AssetExtinguished(assetId);
        if (asset.status == newStatus) revert UnchangedStatus();

        // Convención técnica de demo: cualquier estado distinto desde un origen no extinguido.
        LegalStatus previousStatus = asset.status;
        asset.status = newStatus;
        asset.evidenceHash = evidenceHash;
        asset.revision += 1;
        asset.recordedAt = uint64(block.timestamp);
        emit LegalStatusChanged(assetId, previousStatus, newStatus, evidenceHash, asset.revision, asset.recordedAt, msg.sender);
    }

    /// @notice Lee el estado vigente, incluso si está extinguido; falla si no existe.
    function getAsset(bytes32 assetId) external view returns (Asset memory) {
        if (assets[assetId].revision == 0) revert AssetNotFound(assetId);
        return assets[assetId];
    }
}
