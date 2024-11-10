import { Contract } from '@algorandfoundation/tealscript';
import PaymentTransaction from 'algosdk/dist/types/types/transactions/payment';

type FilePostId = { nonce: uint64 };

type FilePostData = {
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
// MBR Calculations for File Posts and Likes
// 0.0025 Algo per box base
// 0.0004 Algo per byte in the box

// Poll_mbr
// => (8) fields => (32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8) = 96 bytes
// MBR = (96 * 0.0004) + 0.0025 = 0.0422 + 0.0025 = 0.0447 Algo

const filePostMbr = 4470; // Represents 0.0447 Algo in microAlgos
//-------------------------------------------------------------------------------------------------------------

type FilePostLikeId = { postId: FilePostId };

type FilePostLikeInfo = { userAddress: Address; timestamp: uint64 };

// Like_mbr
// => (8) fields => (8 + 32) = 40 bytes
// MBR = (48 * 0.0004) + 0.0025 = 0.0192 + 0.0025 = 0.0217 Algo

const likeMbr = 2_170; // Represents 0.0185 Algo in microAlgos
//-------------------------------------------------------------------------------------------------------------

type FilePostReplyId = { postId: FilePostId };

type FilePostReplyInfo = { userAddress: Address; timestamp: uint64; country: string; asset_id: AssetID; text: string };

// Reply_mbr
// => Fields = (32 + 8 + 32 + 8 + 32) = 112 bytes
// MBR = (112 * 0.0004) + 0.0025 = 0.0448 + 0.0025 = 0.0473 Algo

const replyMbr = 4730; // Represents 0.0473 Algo in microAlgos
//-------------------------------------------------------------------------------------------------------------

export class WecoopFilePost extends Contract {
  totalFilePosts = GlobalStateKey<uint64>();
  totalLikes = GlobalStateKey<uint64>();
  manager_address = GlobalStateKey<Address>();

  // Setting boxes for file posts and likes
  filePosts = BoxMap<FilePostId, FilePostData>({ prefix: 'filePost_' });
  filePostLikes = BoxMap<FilePostLikeId, FilePostLikeInfo>({ prefix: 'filePostLike_' });
  filePostReplies = BoxMap<FilePostReplyId, FilePostReplyInfo>({ prefix: 'filePostReply_' });

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
    verifyPayTxn(mbrTxn, { amount: { greaterThanEqualTo: filePostMbr } });

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

  likeFilePost(
    filePostId: FilePostId,
    mbrTxn: PayTxn,
    platformAlgoFeeTxn: PayTxn,
    creatorPayTxn: AssetTransferTxn,
    platformCommunityFeeTxn: AssetTransferTxn
  ) {
    assert(this.filePosts(filePostId).exists, 'File post that is trying to be liked does not exist');
    // User can like only once
    assert(!this.filePostLikes({ postId: filePostId }).exists, 'User already liked this File post');
    const likedFilePost: FilePostData = this.filePosts(filePostId).value;

    // Ensure that the mbrTxn is at least the amount needed to create the box
    verifyPayTxn(mbrTxn, { amount: { greaterThanEqualTo: mbrTxn.amount } });

    //Ensure that the Algo fee is going to the manager address
    verifyPayTxn(platformAlgoFeeTxn, { receiver: this.manager_address.value });

    // Ensure that the like generates a payment to the creator of the file post
    assert(
      creatorPayTxn.assetReceiver == likedFilePost.creator_address,
      'Creator fee transaction for like is not to the creator address'
    );

    // Ensure that the receiver of the community payment fee and the algo fee is the manager address
    assert(
      platformCommunityFeeTxn.assetReceiver == this.manager_address.value,
      'Community coin payment is not being made to the manager address on liking file post'
    );

    this.totalLikes.value += 1;

    this.filePosts(filePostId).value.likes += 1;

    this.filePostLikes({ postId: filePostId }).value = {
      userAddress: this.txn.sender,
      timestamp: globals.latestTimestamp,
    };
  }

  replyFilePost(
    filePostId: FilePostId,
    country: string,
    assetId: AssetID,
    text: string,
    mbrTxn: PayTxn,
    platformAlgoFeeTxn: PayTxn,
    creatorPayTxn: AssetTransferTxn,
    platformCommunityFeeTxn: AssetTransferTxn
  ) {
    const repliedFilePost: FilePostData = this.filePosts(filePostId).value;

    // Ensure that the like generates a payment to the creator of the file post
    assert(
      creatorPayTxn.assetReceiver == repliedFilePost.creator_address,
      'Creator fee transaction for reply is not to the creator address'
    );

    verifyPayTxn(platformAlgoFeeTxn, { receiver: this.manager_address.value });
    verifyPayTxn(mbrTxn, { receiver: this.app.address });

    // Ensure that the receiver of the community payment fee and the algo fee is the manager address
    assert(
      platformCommunityFeeTxn.assetReceiver == this.manager_address.value,
      'Community coin payment is not being made to the manager address on replying file post'
    );

    assert(this.filePosts(filePostId).exists, 'Trying to reply to a non existing file post');

    this.filePostReplies({ postId: filePostId }).value = {
      userAddress: this.txn.sender,
      timestamp: globals.latestTimestamp,
      country: country,
      asset_id: assetId,
      text: text,
    };
  }

  flagFilePost() {}

  // Method to retrieve a file post by PostId
  getFilePostByPostId(postId: FilePostId): FilePostData {
    assert(this.filePosts(postId).exists, 'File post does not exist');
    return this.filePosts(postId).value;
  }
}
