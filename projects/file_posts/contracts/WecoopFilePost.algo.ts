import { Contract } from '@algorandfoundation/tealscript';
import PaymentTransaction from 'algosdk/dist/types/types/transactions/payment';

type PostId = { nonce: uint64 };

type PostData = {
  creator_address: Address;
  timestamp: uint64;
  likes: uint64;
  replies: uint64;
  strikes: uint64;
  asset_id: AssetID;
  country: string;
  file_cid: string;
  file_format: string;
  text: string;
};

//-------------------------------------------------------------------------------------------------------------
//0.0025 Algo per box
//0.0004 per byte in the box
//Poll_mbr
// => (8) => (32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8) = 8 + 88 = (96 bits * 0.0004) + 0.00384 = 0.0422 + 0.0025 = 0.0447

const filePostMbr = 4_470;
//-------------------------------------------------------------------------------------------------------------

type LikeId = { postId: PostId };

type LikeInfo = { liker: Address; timestamp: uint64 };

// Like_mbr
// => (8, 8) => (8, 32) = 16bits + 40bits = (56bits * 0.0004) + 0.0025 = 0.0212 + 0.0025 = 0.0237

const voteMbr = 2_370;
//-------------------------------------------------------------------------------------------------------------
export class WecoopFilePost extends Contract {
  totalFilePosts = GlobalStateKey<uint64>();
  totalLikes = GlobalStateKey<uint64>();
  manager_address = GlobalStateKey<Address>();

  filePosts = BoxMap<PostId, PostData>({ prefix: 'filePost_' }); // Mapping for file posts

  createApplication(): void {
    this.totalFilePosts.value = 0;
    this.totalLikes.value = 0;
    this.manager_address.value = this.txn.sender;
  }

  optinToAsset(assetId: AssetID, mbrTxn: PayTxn) {
    assert(this.txn.sender == this.manager_address.value, 'Only the manager can opt this contract to a new asset');
    sendAssetTransfer({ assetReceiver: this.app.address, assetAmount: 0, xferAsset: assetId });
  }

  // Method to create and store a file post with its CID
  createFilePost(
    mbrTxn: PayTxn,
    axfer: AssetTransferTxn,
    country: string,
    cid: string,
    fileFormat: string,
    text: string
  ): void {
    // Verify asset opt-in
    assert(this.app.address.isOptedInToAsset(axfer.xferAsset), 'Application not opted in to the asset');

    // Confirm deposit transaction is to the app address
    assert(axfer.assetReceiver === this.app.address, 'Deposit transaction not to the app wallet');

    // Define the creator and post ID
    const creatorAddress: Address = axfer.sender;
    const currentNonce: uint64 = this.totalFilePosts.value;
    const newNonce: uint64 = currentNonce + 1;

    // Check if post does not already exist
    assert(!this.filePosts({ nonce: newNonce }).exists, 'This file post already exists!');

    // Verify MBR for file post creation
    verifyPayTxn(mbrTxn, { amount: filePostMbr });

    // Increment the file post count
    this.totalFilePosts.value += 1;

    // Store the post with CID
    this.filePosts({ nonce: newNonce }).value = {
      text: text,
      creator_address: creatorAddress,
      likes: 0,
      replies: 0,
      strikes: 0,
      asset_id: axfer.xferAsset,
      timestamp: globals.latestTimestamp,
      country: country,
      file_cid: cid,
      file_format: fileFormat,
    };
  }

  // Method to retrieve a file post by PostId
  getFilePostByPostId(postId: PostId): PostData {
    assert(this.filePosts(postId).exists, 'File post does not exist');
    return this.filePosts(postId).value;
  }
}
