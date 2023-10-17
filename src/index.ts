import { Command } from 'commander'
import chalk from 'chalk'
import DescopeClient from '@descope/node-sdk'
import * as readline from 'readline'

const program = new Command()

export const getCode = async (query: string) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  return await new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close()
      resolve(ans)
    })
  }
  )
}

program
  .name('cli-authentication')
  .description('Sample app for CLI authentication with Descope')
  .version('1.0.0')
  .command('login')
  .requiredOption(
    '-e, --email <email>',
    'email of user'
  )
  .requiredOption(
    '-p, --projectId <projectId>',
    'Descope Project ID'
  )
  .action(async (opts) => {
    const clientAuth = DescopeClient({ projectId: opts.projectId })

    const res = await clientAuth.otp.signUpOrIn.email(opts.email)
    if (!res.ok) {
      console.log(`Error ${res.error?.errorCode}: ${res.error?.errorDescription}`)
      return
    }
    const code = await getCode(chalk.yellow('Please type code sent by email: '))
    const jwt = await clientAuth.otp.verify.email(opts.email, `${code}`)

    if (!res.ok) {
      console.log(`Error ${res.error?.errorCode}: ${res.error?.errorDescription}`)
      return
    }
    console.log(chalk.green('Code verified successfully.'))

    console.log('User logged in')
    console.log('**************')
    console.log(jwt.data)
    console.log()

    console.log('User Details (me)')
    console.log('**************')
    const me = await clientAuth.me(jwt.data?.refreshJwt)
    console.log(me.data)
    console.log()

    console.log('Refreshing...')
    const newJwt = await clientAuth.refreshSession(jwt.data?.refreshJwt ?? '')
    console.log()
    console.log('New Session JWT2:')
    console.log(newJwt)
  })

program.parse()
