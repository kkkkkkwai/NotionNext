import { Head, Html, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang='zh-CN'>
      <Head>
        <link rel='icon' href='/farm/logo.png' />
      </Head>
      <body style={{ margin: 0 }}>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
