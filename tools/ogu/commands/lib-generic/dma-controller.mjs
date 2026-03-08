/**
 * DMA Controller — Direct Memory Access transfers.
 */
export function createDMAController() {
  let transfers = 0, bytesTransferred = 0;
  function transfer(src, srcOffset, dst, dstOffset, length) {
    for (let i = 0; i < length; i++) {
      dst[dstOffset + i] = src[srcOffset + i];
    }
    transfers++;
    bytesTransferred += length;
  }
  function getStats() { return { transfers, bytesTransferred }; }
  return { transfer, getStats };
}
