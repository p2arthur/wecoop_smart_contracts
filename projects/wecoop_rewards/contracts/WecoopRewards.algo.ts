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
  claimed_amount = LocalStateKey<uint64>();

  optInToApplication() {
    this.claimed_amount(this.txn.sender).value = 0;
  }

  //ADMIN METHODS ------------------------------------------------------------------------------------------------------------------------------
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

  //ADMIN METHODS ------------------------------------------------------------------------------------------------------------------------------

  //POST METHODS ------------------------------------------------------------------------------------------------------------------------------
  createPost(axfer: AssetTransferTxn) {
    //Assert that the user is sending a payment transaction to the wecoop main address in order to get rewarded
    // assert(
    //   axfer.assetReceiver === this.wecoop_main_address.value,
    //   'Send a post transaction to wecoop in order to be rewarded'
    // );
    const reward: uint64 = this.calculatePostReward('like');
    // // assert(this.app.address.assetBalance(this.wecoop_token) === reward, 'No more rewards to be distributed');
    this.total_rewards.value -= reward;
    this.claimed_amount(this.txn.sender).value += reward;
    sendAssetTransfer({ assetReceiver: this.txn.sender, assetAmount: reward, xferAsset: this.wecoop_token.value });
  }
  //POST METHODS ------------------------------------------------------------------------------------------------------------------------------
  //VOTE METHODS ------------------------------------------------------------------------------------------------------------------------------

  createVote() {}

  //VOTE METHODS ------------------------------------------------------------------------------------------------------------------------------

  //UTIL METHODS ------------------------------------------------------------------------------------------------------------------------------
  private calculatePostReward(type: string): uint64 {
    let amount: uint64 = 0;

    if (type === 'create') {
      amount = 10;
    } else if (type === 'reply') {
      amount = 5;
    } else if (type === 'like') {
      amount = 2;
    }

    return amount;
  }

  private calculatePollReward(type: string): uint64 {
    let amount: uint64 = 0;

    if (type === 'create') {
      amount = 10;
    } else if (type === 'vote') {
      amount = 5;
    }

    return amount;
  }
  //UTIL METHODS ------------------------------------------------------------------------------------------------------------------------------
}
