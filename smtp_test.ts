import { ContentTransferEncoding, SmtpClient } from "./mod.ts";

const smtpClient = new SmtpClient({ debug: true });

const isTls = false;

if (isTls) {
  await smtpClient.connectTls({
    hostname: "smtp.163.com",
    username: "<username>",
    password: "<password>",
  });
} else {
  await smtpClient.connect({
    hostname: "smtp.163.com",
    username: "<username>",
    password: "<password>",
  });
}

// send text
await smtpClient.send({
  from: "<from email>",
  to: "<to email>",
  subject: `邮件主题-(${new Date().toString()})`,
  text: `这里是邮件内容,验证码：${Math.random().toString().slice(-6)}`,
  // html : `<h1>验证码：<strong>${Math.random().toString().slice(-6)}</strong><h1>`
});

// send html
await smtpClient.send({
  from: "<from email>",
  to: "<to email>",
  subject: `邮件主题-(${new Date().toString()})`,
  // text: `这里是邮件内容,验证码：${Math.random().toString().slice(-6)}`,
  html: `<h1>这里是邮件内容,验证码:<strong>${
    Math.random().toString().slice(-6)
  }</strong><h1>`,
});

smtpClient.close();

// deno run -A smtp_test.ts
