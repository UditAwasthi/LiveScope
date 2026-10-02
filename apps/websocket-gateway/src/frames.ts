import { createHash } from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export function websocketAccept(key: string): string {
  return createHash('sha1').update(key + GUID).digest('base64');
}

export function encodeServerText(text: string): Buffer {
  const payload = Buffer.from(text);
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header[1] = 126;
  header.writeUInt16BE(payload.length, 2);
  return Buffer.concat([header, payload]);
}

export interface DecodedFrame {
  opcode: number;
  text: string;
  rest: Buffer<ArrayBufferLike>;
}

export function tryDecodeClientFrame(buffer: Buffer<ArrayBufferLike>): DecodedFrame | undefined {
  if (buffer.length < 2) return undefined;
  const opcode = buffer[0]! & 0x0f;
  const masked = (buffer[1]! & 0x80) !== 0;
  let length = buffer[1]! & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < 4) return undefined;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    return undefined;
  }
  const maskLength = masked ? 4 : 0;
  if (buffer.length < offset + maskLength + length) return undefined;
  const data = Buffer.from(buffer.subarray(offset + maskLength, offset + maskLength + length));
  if (masked) {
    const mask = buffer.subarray(offset, offset + 4);
    for (let i = 0; i < data.length; i += 1) data[i] = data[i]! ^ mask[i % 4]!;
  }
  return {
    opcode,
    text: opcode === 1 ? data.toString('utf8') : '',
    rest: Buffer.from(buffer.subarray(offset + maskLength + length)),
  };
}
