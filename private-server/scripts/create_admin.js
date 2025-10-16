// Create or update an admin user directly in storage
// Usage (inside container):
//   STORAGE_SOCKET=/screeps/storage.sock node /screeps/create_admin.js

const path = require('path')
const common = require('/opt/screeps-cli/node_modules/@screeps/common')
const Auth = require('/screeps/node_modules/screepsmod-auth/lib/auth')

const USERNAME = process.env.ADMIN_USER || 'myadmin'
const PASSWORD = process.env.ADMIN_PASS || 'StrongPass123'

async function main() {
  if (!process.env.STORAGE_SOCKET) {
    process.env.STORAGE_SOCKET = '/screeps/storage.sock'
  }
  await common.load()
  const db = common.storage.db
  const env = common.storage.env
  let u = await db.users.findOne({ username: USERNAME })
  if (!u) {
    u = await db.users.insert({
      username: USERNAME,
      usernameLower: USERNAME.toLowerCase(),
      email: '',
      cpu: 100,
      cpuAvailable: 0,
      registeredDate: new Date(),
      blocked: false,
      money: 0,
      gcl: 0
    })
    await db['users.code'].insert({
      user: u._id,
      modules: { main: '' },
      branch: 'default',
      activeWorld: true,
      activeSim: true
    })
    await env.set('scrUserMemory:' + u._id, JSON.stringify({}))
    console.log('CREATED', u._id)
  } else {
    console.log('EXISTS', u._id)
  }
  const a = new Auth()
  const { salt, pass } = await a.encrypt_password(PASSWORD)
  await db.users.update({ _id: u._id }, { $set: { salt, password: pass } })
  console.log('PASSWORD_SET for', USERNAME)
}

main().catch(e => {
  console.error('ERR', e && (e.stack || e.message || e))
  process.exit(1)
})
