import { Contract } from '@algorandfoundation/tealscript';
import PaymentTransaction from 'algosdk/dist/types/types/transactions/payment';

// Base Contract for Wecoop Rewards
export class WecoopRewards extends Contract {
  // Global State Keys
  wecoop_token = GlobalStateKey<AssetID>(); // Storing asset information
  wecoop_main_address = GlobalStateKey<Address>({ key: 'DZ6ZKA6STPVTPCTGN2DO5J5NUYEETWOIB7XVPSJ4F3N2QZQTNS3Q7VIXCM' });
  reward_cycle = GlobalStateKey<uint64>();
  total_rewards = GlobalStateKey<uint64>();

  // Local State Map for tracking user actions
  user = LocalStateKey<{
    postsCreated: uint64;
    repliesMade: uint64;
    postsLiked: uint64;
    pollsCreated: uint64;
    votesCast: uint64;
  }>();

  bootstrap(mbrTxn: PayTxn, asset: AssetID) {
    // Verify if the one calling this function is the app creator
    assert(this.txn.sender === this.app.creator, 'Error: Not the creator trying to optin to an asset');

    //Verify if the receiver of the mbr transaction is the application address
    assert(mbrTxn.receiver === this.app.address, 'Receiver is not the app address');

    //Verify that the app address is not opted in to the asset provided
    assert(!this.app.address.isOptedInToAsset(asset));

    //Verify that the mbr transaction fulfills the minimum balane requirements
    verifyPayTxn(mbrTxn, { amount: { greaterThanEqualTo: globals.minBalance + globals.assetOptInMinBalance } });

    this.wecoop_token.value = asset;

    // Opt the application address to the given asset
    sendAssetTransfer({ assetReceiver: this.app.address, assetAmount: 0, xferAsset: asset });
  }

  initiateRewardCycle(axfer: AssetTransferTxn): void {
    // //Assert that its the wecoop main address who is depositing the rewards
    // assert(this.txn.sender === this.wecoop_main_address.value);

    // //Assert that the the deposit axfer is being made by the wecoop address
    // assert(axfer.sender === this.wecoop_main_address.value);

    //Assert that the deposited asset is actually the wecoop token
    assert(axfer.xferAsset === this.wecoop_token.value);

    //Add 1 to the current reward cycle
    this.reward_cycle.value += 1;

    //Add the deposited amount to the total_rewards
    const depositedAmount: uint64 = axfer.assetAmount;

    this.total_rewards.value += depositedAmount;
  }
}
