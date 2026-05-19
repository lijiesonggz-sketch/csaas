/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS preload runs before Next CLI starts. */
const fs = require('fs')
const path = require('path')

if (process.platform === 'win32' && !process.env.CSAAS_DISABLE_SYMLINK_FALLBACK) {
  const originalSymlink = fs.promises.symlink.bind(fs.promises)
  const originalSymlinkCallback = fs.symlink.bind(fs)
  const originalSymlinkSync = fs.symlinkSync.bind(fs)

  function shouldFallback(error) {
    return error?.code === 'EPERM' || error?.code === 'EACCES'
  }

  function resolveTarget(target, destination) {
    return path.isAbsolute(target) ? target : path.resolve(path.dirname(destination), target)
  }

  async function copyTargetToDestination(target, destination) {
    const resolvedTarget = resolveTarget(target, destination)
    const stats = await fs.promises.stat(resolvedTarget)

    await fs.promises.rm(destination, { recursive: true, force: true })
    await fs.promises.mkdir(path.dirname(destination), { recursive: true })
    if (stats.isDirectory()) {
      await fs.promises.cp(resolvedTarget, destination, {
        recursive: true,
        dereference: true,
        force: true,
        errorOnExist: false,
      })
      return
    }

    await fs.promises.copyFile(resolvedTarget, destination)
  }

  function copyTargetToDestinationSync(target, destination) {
    const resolvedTarget = resolveTarget(target, destination)
    const stats = fs.statSync(resolvedTarget)

    fs.rmSync(destination, { recursive: true, force: true })
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    if (stats.isDirectory()) {
      fs.cpSync(resolvedTarget, destination, {
        recursive: true,
        dereference: true,
        force: true,
        errorOnExist: false,
      })
      return
    }

    fs.copyFileSync(resolvedTarget, destination)
  }

  fs.promises.symlink = async function symlinkWithCopyFallback(target, destination, type) {
    try {
      return await originalSymlink(target, destination, type)
    } catch (error) {
      if (!shouldFallback(error)) {
        throw error
      }

      try {
        await copyTargetToDestination(target, destination)
      } catch (fallbackError) {
        throw fallbackError
      }
    }
  }

  fs.symlink = function symlinkCallbackWithCopyFallback(target, destination, type, callback) {
    const symlinkType = typeof type === 'function' ? undefined : type
    const done = typeof type === 'function' ? type : callback

    return originalSymlinkCallback(target, destination, symlinkType, (error) => {
      if (!error) {
        done?.(null)
        return
      }

      if (!shouldFallback(error)) {
        done?.(error)
        return
      }

      copyTargetToDestination(target, destination).then(
        () => done?.(null),
        (fallbackError) => done?.(fallbackError)
      )
    })
  }

  fs.symlinkSync = function symlinkSyncWithCopyFallback(target, destination, type) {
    try {
      return originalSymlinkSync(target, destination, type)
    } catch (error) {
      if (!shouldFallback(error)) {
        throw error
      }

      copyTargetToDestinationSync(target, destination)
    }
  }
}
