import { Contract } from '@algorandfoundation/tealscript';

type PollId = { nonce: uint64 };

type PollInfo = {
  creator: Address;
  selected_asset: AssetID;
  question: string;
  totalVotes: uint64;
  yesVotes: uint64;
  deposited: uint64;
};

// -------------------------------------------------------------------------------------------------------------
//0.0025 Algo per box
//0.0004 per byte in the box
//Poll_mbr
// => (8) => (32 + 8 + 8 + 8 + 8 + 8) = 8 + 72 = (80 bits * 0.0004) + 0.0025 = 0.032 + 0.0025 = 0.03450

const pollMbr = 3_450;

type VoteId = { nonce: uint64; pollId: PollId };

type VoteInfo = { claimed: boolean; voter: Address };

//Vote_mbr
// => (8, 8) => (8, 32) = 16bits + 40bits = (56bits * 0.0004) + 0.0025 = 0.0212 + 0.0025 = 0.0237

const voteMbr = 2_370;
// -------------------------------------------------------------------------------------------------------------
export class WecoopDao extends Contract {
  totalPolls = GlobalStateKey<uint64>();
  totalVotes = GlobalStateKey<uint64>();

  poll = BoxMap<PollId, PollInfo>({ prefix: 'poll_' });
  vote = BoxMap<VoteId, VoteInfo>({ prefix: 'vote_' });

  createApplication(): void {
    this.totalPolls.value = 0;
    this.totalVotes.value = 0;
  }

  //This method opts in the contract account to the asset that will be then be used to fund the polls
  optinToAsset(mbrTxn: PayTxn, asset: AssetID): void {
    // Verify if the one calling this function is the app creator
    assert(this.txn.sender === this.app.creator, 'Error: Not the creator trying to optin to an asset');

    //Verify if the receiver of the mbr transaction is the application address
    assert(mbrTxn.receiver === this.app.address, 'Receiver is not the app address');

    //Verify that the app address is not opted in to the asset provided
    assert(!this.app.address.isOptedInToAsset(asset));

    //Verify that the mbr transaction fulfills the minimum balane requirements
    verifyPayTxn(mbrTxn, { amount: { greaterThanEqualTo: globals.minBalance + globals.assetOptInMinBalance } });

    // Opt the application address to the given asset
    sendAssetTransfer({ assetReceiver: this.app.address, assetAmount: 0, xferAsset: asset });
  }

  /*
  
  */
  createPoll(mbrTxn: PayTxn, axfer: AssetTransferTxn, question: string): PollInfo {
    //Check if the contract account is opted in to the deposited asset
    assert(this.app.address.isOptedInToAsset(axfer.xferAsset), 'Application not opted in to the asset');

    //Check if the the receiver of the deposit is the app address
    assert(axfer.assetReceiver === this.app.address, 'Deposit transaction not to the app wallet');

    //Define the wallet address creating the poll
    const creatorAddress: Address = axfer.sender;

    //Get the current nonce for identifying the poll
    const currentNonce: uint64 = this.totalPolls.value;

    //Define a new nonce to be applied to the new poll that just got created
    const newNonce: uint64 = currentNonce === 0 ? currentNonce + 1 : 0;

    //Check if the current poll bein created does not already exists
    assert(!this.poll({ nonce: newNonce }).exists, 'This poll already exists!');

    //Check if the mbr transaction has enough funds to create the needed
    verifyPayTxn(mbrTxn, { amount: pollMbr });

    //Add one to the total polls of the contract global state
    this.totalPolls.value += 1;

    //Get deposited amount and selected asset
    const deposited = axfer.assetAmount;
    const selecteAsset = axfer.xferAsset;

    //Create the poll box
    this.poll({ nonce: newNonce }).value = {
      question: question,
      creator: creatorAddress,
      totalVotes: 0,
      yesVotes: 0,
      deposited: deposited,
      selected_asset: selecteAsset,
    };

    //Return the poll info
    return this.poll({ nonce: newNonce }).value;
  }

  /*This method is used for a user to cast a vote into a poll
  Checks:
  - Poll with poll id exists
  - Vote with nonce does not already exist
  - If user haven't already voted
  */
  makeVote(pollId: PollId, axfer: AssetTransferTxn, mbrTxn: PayTxn, inFavor: boolean) {
    //Check if the contract account is opted in to the deposited asset
    assert(this.app.address.isOptedInToAsset(axfer.xferAsset), 'Application not opted in to the asset');

    //Check if the the receiver of the deposit is the app address
    assert(axfer.assetReceiver === this.app.address, 'Deposit transaction not to the app wallet');

    //Check if the poll the user is voting in exists
    assert(this.poll(pollId).exists, 'Poll user is trying to vote in does not exist');

    const currentNonce: uint64 = this.poll(pollId).value.totalVotes;

    const newNonce: uint64 = currentNonce === 0 ? currentNonce + 1 : 0;

    //Check if the vote with the current pollId and nonce does not already exist
    assert(!this.vote({ pollId: pollId, nonce: newNonce }).exists, 'Vote with new nonce already exists');

    //Create box with the vote nonce and pollId
    this.vote({ pollId: pollId, nonce: newNonce }).value = { voter: this.txn.sender, claimed: false };

    //Add vote to the poll total votes counter
    this.poll(pollId).value.totalVotes += 1;

    if (inFavor) {
      //If in favor add to the poll inFavor counter
      this.poll(pollId).value.yesVotes += 1;
    }
  }

  getPollByPollId(pollId: PollId): PollInfo {
    assert(this.poll(pollId).exists, 'Searched poll does not exist');
    return this.poll(pollId).value;
  }

  getVoteByVoteId(voteId: VoteId): VoteInfo {
    assert(this.vote(voteId).exists, 'searched vote does not exist');
    return this.vote(voteId).value;
  }
}
