/**
 * deno-smtp是基于deno开发的简单发送邮件
 * 由于使用：https://deno.land/x/smtp 发送邮件偶尔报错，所以自行了解smtp封装。
 * 本库借鉴了https://deno.land/x/smtp的许多方式
 * 参考文献：
 * http://www.ruanyifeng.com/blog/2008/06/mime.html
 * https://www.cnblogs.com/blogxjc/p/10591894.html
 * https://www.cnblogs.com/sdgwc/p/3324368.html
 * 本库属于个人，如若使用请考本或者fork。
 */
interface Command {
  code: number;
  msg: string;
}

interface SmtpClientOptions {
  debug?: boolean;
  encoding?: ContentTransferEncoding;
}

export enum ContentTransferEncoding {
  "7bit" = "7bit",
  "8bit" = "8bit",
  "base64" = "base64",
  "binary" = "binary",
  "quoted-printable" = "quoted-printable",
}

export interface ConnectOptions {
  username: string;
  password: string;
  hostname: string;
  port?: number;
}

export interface ConnectTlsOptions extends ConnectOptions {
  certFile?: string;
}

export interface SendConfig {
  from: string;
  to: string;
  subject: string;
  text?: string; // plain text body
  html?: string; // html body
  date?: string;
  // attachments: Array<Record<string, any>>; // attachments
}

enum Multipart {
  alternative = "alternative", // 纯文本和HTML文本的混合
  mixed = "mixed", //信件内容中有二进制内容
  related = "related", // 信件带有附
}

enum CommandCode {
  READY = 220,
  HELO = 250,
  AUTH_LOGIN = 334,
  AUTH_USERNAME = 334,
  AUTH_PASSWORD = 235,
  MAIL_FROM = 250,
  RCPT_TO = 250,
  DATA = 354,
  SEND_SUCCESS = 250,
}

enum CommandWrite {
  HELO = "HELO",
  AUTH_LOGIN = "AUTH LOGIN",
  MAIL_FROM = "MAIL FROM:",
  RCPT_TO = "RCPT TO:",
  DATA = "DATA",
  SUBJECT = "SUBJECT:",
  FROM = "FROM:",
  TO = "TO:",
  DATE = "DATE:",
}

const CRLF = "\r\n";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class SmtpClient {
  private _conn: Deno.Conn | null;
  private _debug: boolean;
  private _contentTransferEncoding: ContentTransferEncoding;
  constructor(options?: SmtpClientOptions) {
    this._conn = null;
    this._debug = options?.debug || false;
    this._contentTransferEncoding = options?.encoding ||
      ContentTransferEncoding["quoted-printable"];
  }
  /**
   * 非ssl连接
   * @param config
   */
  async connect(config: ConnectOptions) {
    this._conn = await Deno.connect({
      hostname: config.hostname,
      port: config.port || 25,
    });
    await this._connect(config);
  }
  /**
   * ssl连接
   * @param config
   */
  async connectTls(config: ConnectTlsOptions) {
    let options: Deno.ConnectTlsOptions = {
      hostname: config.hostname,
      port: config.port || 465,
    };
    config.certFile && (options.certFile = config.certFile);
    this._conn = await Deno.connectTls(options);
    await this._connect(config);
  }
  /**
   * 发送邮件
   * 发送内容可参考：http://www.ruanyifeng.com/blog/2008/06/mime.html
   */
  async send(config: SendConfig) {
    let [from, fromData] = this._parseAddress(config.from);
    let [to, toData] = this._parseAddress(config.to);

    await this._write(CommandWrite.MAIL_FROM, from);
    this._assertCode(await this._read(), CommandCode.MAIL_FROM);

    await this._write(CommandWrite.RCPT_TO, to);
    this._assertCode(await this._read(), CommandCode.RCPT_TO);

    await this._write(CommandWrite.DATA);
    this._assertCode(await this._read(), CommandCode.DATA);

    await this._write(CommandWrite.SUBJECT, config.subject);
    await this._write(CommandWrite.FROM, fromData);
    await this._write(CommandWrite.TO, toData);
    await this._write(CommandWrite.DATE, config.date || new Date().toString());
    await this._write("MIME-Version: 1.0");

    // content
    if (config.html) {
      /*
            multipart/alternative :纯文本和HTML文本的混合
            multipart/mixed :信件内容中有二进制内容
            multipart/related :信件带有附件
            */
      /*
           boundary :表明不同信件内容的分割线，值是一个随机数
           */
      let boundary = "boundary" + Date.now();
      /* 表面不同信件内容 */
      await this._write(
        `Content-Type:multipart/alternative;boundary=${boundary};charset=utf-8;`,
      );
      /* 信件分割线 */
      await this._write(`--${boundary}`);
      await this._write("Content-Type:text/plain;charset=utf-8");
      await this._write(
        `Content-Transfer-Encoding: ${this._contentTransferEncoding}`,
        CRLF,
      );
      await this._write(config.text || "", CRLF);

      await this._write(`--${boundary}`);
      await this._write("Content-Type:text/html;charset=utf-8");
      await this._write(
        `Content-Transfer-Encoding:${this._contentTransferEncoding}`,
        CRLF,
      );
      await this._write(config.html, `${CRLF}.`);
    } else {
      /*
            text/plain：纯文本，文件扩展名.txt
            text/html：HTML文本，文件扩展名.htm和.html
            image/jpeg：jpeg格式的图片，文件扩展名.jpg
            image/gif：GIF格式的图片，文件扩展名.gif
            audio/x-wave：WAVE格式的音频，文件扩展名.wav
            audio/mpeg：MP3格式的音频，文件扩展名.mp3
            video/mpeg：MPEG格式的视频，文件扩展名.mpg
            application/zip：PK-ZIP格式的压缩文件，文件扩展名.zip
            */
      await this._write("Content-Type:text/plain;charset=utf-8");
      await this._write(
        `Content-Transfer-Encoding:${this._contentTransferEncoding}`,
        CRLF,
      );
      await this._write(config.text || "", `${CRLF}.`);
    }

    this._assertCode(await this._read(), CommandCode.SEND_SUCCESS);
  }
  /**
   * 关闭连接
   */
  async close() {
    this._conn && this._conn.close();
  }
  private async _connect(config: ConnectOptions) {
    this._assertCode(await this._read(), CommandCode.READY);

    await this._write(CommandWrite.HELO, config.hostname);
    this._assertCode(await this._read(), CommandCode.HELO);

    await this._write(CommandWrite.AUTH_LOGIN);
    this._assertCode(await this._read(), CommandCode.AUTH_LOGIN);

    await this._write(btoa(config.username));
    this._assertCode(await this._read(), CommandCode.AUTH_USERNAME);

    await this._write(btoa(config.password));
    this._assertCode(await this._read(), CommandCode.AUTH_PASSWORD);
  }
  private async _read() {
    if (!this._conn) {
      return null;
    }
    let buf = new Uint8Array(100);
    await this._conn.read(buf);
    let result = decoder.decode(buf);
    this._debug && console.table(result);
    if (result === null) {
      return null;
    }
    // 解析数据
    return {
      code: parseInt(result.slice(0, 3).trim()),
      msg: result.slice(3).trim(),
    };
  }
  private async _write(...args: string[]) {
    if (!this._conn) {
      return null;
    }
    this._debug && console.table(args);
    const data = encoder.encode([...args].join(" ") + CRLF);
    await this._conn.write(data);
  }
  private _assertCode(cmd: Command | null, code: number, msg?: string) {
    if (!cmd) {
      throw new Error("invalid cmd");
    } else if (cmd.code !== code) {
      throw new Error(msg || `${cmd.code}: ${cmd.msg}`);
    }
  }
  private _parseAddress(email: string): [string, string] {
    const m = email.toString().match(/(.*)\s<(.*)>/);
    return m?.length === 3
      ? [`<${m[2]}>`, email]
      : [`<${email}>`, `<${email}>`];
  }
}
