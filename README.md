# deno-smtp

基于 deno 开发的简单发送邮件

_本库属于个人，如若使用请复制源码或者 fork,无法保证该库不变动_
_本库借鉴[deno-smtp](https://deno.land/x/smtp)了许多地方_

# 前置

由于使用：https://deno.land/x/smtp 发送邮件偶尔报错，所以自行了解 smtp 封装。

# 使用

```ts
// 由于个人使用、具体可参考源码
import { SmtpClient } from "./mod.ts";

await smtpClient.connect({
  hostname: "smtp.163.com",
  username: "<username>",
  password: "<password>",
});

await smtpClient.send({
  from: "<from email>",
  to: "<to email>",
  subject: `邮件主题-(${new Date().toString()})`,
  text: `这里是邮件内容,验证码：${Math.random().toString().slice(-6)}`,
  // html : `<h1>验证码：<strong>${Math.random().toString().slice(-6)}</strong><h1>`
});

smtpClient.close();
```

# 参考文献

- http://www.ruanyifeng.com/blog/2008/06/mime.html
- https://www.cnblogs.com/blogxjc/p/10591894.html
- https://www.cnblogs.com/sdgwc/p/3324368.html
