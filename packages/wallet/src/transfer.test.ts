import { NativeAssetId } from '@fuel-ts/constants';
import { Provider, ScriptTransactionRequest } from '@fuel-ts/providers';

import { generateTestWallet } from './test-utils';

describe('Wallet', () => {
  it('can transfer a single type of coin to a single destination', async () => {
    const provider = new Provider('http://127.0.0.1:4000/graphql');

    const sender = await generateTestWallet(provider, [[100, NativeAssetId]]);
    const receiver = await generateTestWallet(provider);

    await sender.transfer(receiver.address, 1, NativeAssetId);

    const senderBalances = await sender.getBalances();
    expect(senderBalances).toEqual([{ assetId: NativeAssetId, amount: 99n }]);
    const receiverBalances = await receiver.getBalances();
    expect(receiverBalances).toEqual([{ assetId: NativeAssetId, amount: 1n }]);
  });

  it('can transfer with custom TX Params', async () => {
    const provider = new Provider('http://127.0.0.1:4000/graphql');

    const sender = await generateTestWallet(provider, [[100, NativeAssetId]]);
    const receiver = await generateTestWallet(provider);

    /* Error out because gas is to low */
    await expect(async () => {
      const result = await sender.transfer(receiver.address, 1, NativeAssetId, {
        gasLimit: 1,
        gasPrice: 1,
        bytePrice: 1,
      });
      await result.wait();
    }).rejects.toThrowError('gasLimit(1) is lower than the required (11)');

    await sender.transfer(receiver.address, 1, NativeAssetId, {
      gasLimit: 10000,
    });
    const senderBalances = await sender.getBalances();
    expect(senderBalances).toEqual([{ assetId: NativeAssetId, amount: 99n }]);
    const receiverBalances = await receiver.getBalances();
    expect(receiverBalances).toEqual([{ assetId: NativeAssetId, amount: 1n }]);
  });

  it('can transfer multiple types of coins to multiple destinations', async () => {
    const provider = new Provider('http://127.0.0.1:4000/graphql');

    const assetIdA = '0x0101010101010101010101010101010101010101010101010101010101010101';
    const assetIdB = '0x0202020202020202020202020202020202020202020202020202020202020202';
    const amount = 1n;

    const request = new ScriptTransactionRequest({ gasLimit: 1000000 });
    const sender = await generateTestWallet(provider, [
      [amount * 2n, assetIdA],
      [amount * 2n, assetIdB],
      [10n, NativeAssetId],
    ]);
    const receiverA = await generateTestWallet(provider);
    const receiverB = await generateTestWallet(provider);

    const coins = await sender.getCoinsToSpend([
      [amount * 2n, assetIdA],
      [amount * 2n, assetIdB],
    ]);

    request.addCoins(coins);
    request.addCoinOutputs(receiverA, [
      [amount, assetIdA],
      [amount, assetIdB],
    ]);
    request.addCoinOutputs(receiverB, [
      [amount, assetIdA],
      [amount, assetIdB],
    ]);

    const response = await sender.sendTransaction(request);

    await response.wait();

    const receiverACoins = await receiverA.getCoins();
    expect(receiverACoins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assetId: assetIdA, amount }),
        expect.objectContaining({ assetId: assetIdB, amount }),
      ])
    );

    const receiverBCoins = await receiverB.getCoins();
    expect(receiverBCoins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assetId: assetIdA, amount }),
        expect.objectContaining({ assetId: assetIdB, amount }),
      ])
    );
  });
});
