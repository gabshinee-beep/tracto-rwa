const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const [Pending, Active, Suspended, Extinguished] = [0, 1, 2, 3];
const id = ethers.id("registro-demo-A");
const otherId = ethers.id("registro-demo-B");
const evidence = ethers.id("evidencia-1");
const nextEvidence = ethers.id("evidencia-2");
const zero = ethers.ZeroHash;

async function fixture() {
  const [owner, outsider] = await ethers.getSigners();
  const registry = await ethers.deployContract("TractoRWA");
  await registry.waitForDeployment();
  return { registry, owner, outsider };
}

async function blockTimestamp(tx) {
  const receipt = await tx.wait();
  const block = await ethers.provider.getBlock(receipt.blockNumber);
  return BigInt(block.timestamp);
}

describe("TractoRWA: demo local", function () {
  it("asigna el operador y registra Pending, revisión 1, fecha y actor reales del bloque", async function () {
    const { registry, owner } = await loadFixture(fixture);
    expect(await registry.owner()).to.equal(owner.address);
    const tx = await registry.registerAsset(id, evidence, zero);
    const recordedAt = await blockTimestamp(tx);
    expect(await registry.getAsset(id)).to.deep.equal([0n, evidence, zero, 1n, recordedAt]);
    await expect(tx).to.emit(registry, "AssetRegistered")
      .withArgs(id, Pending, evidence, zero, 1, recordedAt, owner.address);
  });

  it("limita ambas escrituras al operador sin modificar el registro", async function () {
    const { registry, outsider } = await loadFixture(fixture);
    await expect(registry.connect(outsider).registerAsset(id, evidence, zero))
      .to.be.revertedWithCustomError(registry, "Unauthorized");
    await expect(registry.getAsset(id)).to.be.revertedWithCustomError(registry, "AssetNotFound").withArgs(id);
    await registry.registerAsset(id, evidence, zero);
    const before = await registry.getAsset(id);
    await expect(registry.connect(outsider).updateLegalStatus(id, Active, nextEvidence))
      .to.be.revertedWithCustomError(registry, "Unauthorized");
    expect(await registry.connect(outsider).getAsset(id)).to.deep.equal(before);
  });

  it("rechaza clave cero y evidencia cero en ambas operaciones", async function () {
    const { registry } = await loadFixture(fixture);
    await expect(registry.registerAsset(zero, evidence, zero))
      .to.be.revertedWithCustomError(registry, "EmptyAssetId");
    await expect(registry.registerAsset(id, zero, zero))
      .to.be.revertedWithCustomError(registry, "EmptyEvidenceHash");
    await expect(registry.getAsset(id)).to.be.revertedWithCustomError(registry, "AssetNotFound").withArgs(id);
    await registry.registerAsset(id, evidence, zero);
    const before = await registry.getAsset(id);
    await expect(registry.updateLegalStatus(id, Active, zero))
      .to.be.revertedWithCustomError(registry, "EmptyEvidenceHash");
    expect(await registry.getAsset(id)).to.deep.equal(before);
  });

  for (const status of [Pending, Active, Extinguished]) {
    it(`rechaza duplicar una clave en estado ${status}`, async function () {
      const { registry } = await loadFixture(fixture);
      await registry.registerAsset(id, evidence, zero);
      if (status !== Pending) await registry.updateLegalStatus(id, status, nextEvidence);
      const before = await registry.getAsset(id);
      await expect(registry.registerAsset(id, nextEvidence, otherId))
        .to.be.revertedWithCustomError(registry, "AssetAlreadyRegistered").withArgs(id);
      expect(await registry.getAsset(id)).to.deep.equal(before);
    });
  }

  it("rechaza consultar y actualizar registros inexistentes", async function () {
    const { registry } = await loadFixture(fixture);
    for (const missingId of [id, zero]) {
      await expect(registry.getAsset(missingId))
        .to.be.revertedWithCustomError(registry, "AssetNotFound").withArgs(missingId);
      await expect(registry.updateLegalStatus(missingId, Active, evidence))
        .to.be.revertedWithCustomError(registry, "AssetNotFound").withArgs(missingId);
    }
  });

  it("actualiza evidencia, revisión y fecha conservando referencia y emitiendo estado previo", async function () {
    const { registry, owner } = await loadFixture(fixture);
    await registry.registerAsset(id, evidence, otherId);
    const before = await registry.getAsset(id);
    await time.setNextBlockTimestamp(Number(before.recordedAt) + 60);
    const tx = await registry.updateLegalStatus(id, Active, nextEvidence);
    const recordedAt = await blockTimestamp(tx);
    expect(recordedAt).to.equal(before.recordedAt + 60n);
    expect(await registry.getAsset(id)).to.deep.equal([1n, nextEvidence, otherId, 2n, recordedAt]);
    await expect(tx).to.emit(registry, "LegalStatusChanged")
      .withArgs(id, Pending, Active, nextEvidence, 2, recordedAt, owner.address);
  });

  for (const from of [Pending, Active, Suspended]) {
    for (const to of [Pending, Active, Suspended, Extinguished]) {
      if (from === to) continue;
      it(`permite transición técnica demo ${from} -> ${to} con revisión consecutiva`, async function () {
        const { registry, owner } = await loadFixture(fixture);
        await registry.registerAsset(id, evidence, zero);
        if (from !== Pending) await registry.updateLegalStatus(id, from, evidence);
        const before = await registry.getAsset(id);
        const tx = await registry.updateLegalStatus(id, to, nextEvidence);
        const recordedAt = await blockTimestamp(tx);
        expect(await registry.getAsset(id)).to.deep.equal([
          BigInt(to), nextEvidence, zero, before.revision + 1n, recordedAt
        ]);
        await expect(tx).to.emit(registry, "LegalStatusChanged")
          .withArgs(id, from, to, nextEvidence, before.revision + 1n, recordedAt, owner.address);
      });
    }
  }

  for (const status of [Pending, Active, Suspended]) {
    it(`rechaza repetir estado ${status}, incluso con evidencia nueva`, async function () {
      const { registry } = await loadFixture(fixture);
      await registry.registerAsset(id, evidence, zero);
      if (status !== Pending) await registry.updateLegalStatus(id, status, evidence);
      const before = await registry.getAsset(id);
      await expect(registry.updateLegalStatus(id, status, nextEvidence))
        .to.be.revertedWithCustomError(registry, "UnchangedStatus");
      expect(await registry.getAsset(id)).to.deep.equal(before);
    });
  }

  it("Extinguished no admite ningún estado ni modificación y sigue consultable", async function () {
    const { registry } = await loadFixture(fixture);
    await registry.registerAsset(id, evidence, zero);
    await registry.updateLegalStatus(id, Extinguished, evidence);
    const before = await registry.getAsset(id);
    for (const status of [Pending, Active, Suspended, Extinguished]) {
      await expect(registry.updateLegalStatus(id, status, nextEvidence))
        .to.be.revertedWithCustomError(registry, "AssetExtinguished").withArgs(id);
      expect(await registry.getAsset(id)).to.deep.equal(before);
    }
  });

  it("corrige mediante una clave nueva sin sustituir ni reabrir el registro extinguido", async function () {
    const { registry, owner } = await loadFixture(fixture);
    await registry.registerAsset(id, evidence, zero);
    await registry.updateLegalStatus(id, Extinguished, evidence);
    const original = await registry.getAsset(id);
    const tx = await registry.registerAsset(otherId, nextEvidence, id);
    const recordedAt = await blockTimestamp(tx);
    expect(await registry.getAsset(otherId)).to.deep.equal([0n, nextEvidence, id, 1n, recordedAt]);
    expect(await registry.getAsset(id)).to.deep.equal(original);
    await expect(tx).to.emit(registry, "AssetRegistered")
      .withArgs(otherId, Pending, nextEvidence, id, 1, recordedAt, owner.address);
  });

  it("permite referencia no registrada sin crear el destino", async function () {
    const { registry } = await loadFixture(fixture);
    await registry.registerAsset(id, evidence, otherId);
    expect((await registry.getAsset(id)).correctsAssetId).to.equal(otherId);
    await expect(registry.getAsset(otherId))
      .to.be.revertedWithCustomError(registry, "AssetNotFound").withArgs(otherId);
  });

  it("mantiene dos activos independientes y permite referenciar uno no extinguido", async function () {
    const { registry } = await loadFixture(fixture);
    await registry.registerAsset(id, evidence, zero);
    const original = await registry.getAsset(id);
    await registry.registerAsset(otherId, nextEvidence, id);
    const second = await registry.getAsset(otherId);
    expect(await registry.getAsset(id)).to.deep.equal(original);
    await registry.updateLegalStatus(id, Active, nextEvidence);
    expect(await registry.getAsset(otherId)).to.deep.equal(second);
    const firstUpdated = await registry.getAsset(id);
    await registry.updateLegalStatus(otherId, Suspended, evidence);
    expect(await registry.getAsset(id)).to.deep.equal(firstUpdated);
  });
});
