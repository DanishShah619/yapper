import sodium from 'libsodium-wrappers';

export async function encryptMessage(plaintext: string, recipientPublicKey: string, senderPrivateKey: string): Promise<string> {
  await sodium.ready;
  const messageBytes = sodium.from_string(plaintext);
  const recipientKey = sodium.from_base64(recipientPublicKey);
  const senderKey = sodium.from_base64(senderPrivateKey);
  const encrypted = sodium.crypto_box_seal(messageBytes, recipientKey);
  return sodium.to_base64(encrypted);
}

export async function decryptMessage(ciphertext: string, recipientPrivateKey: string, recipientPublicKey: string): Promise<string> {
  await sodium.ready;
  const cipherBytes = sodium.from_base64(ciphertext);
  const privKey = sodium.from_base64(recipientPrivateKey);
  const pubKey = sodium.from_base64(recipientPublicKey);
  const decrypted = sodium.crypto_box_seal_open(cipherBytes, pubKey, privKey);
  return sodium.to_string(decrypted);
}
