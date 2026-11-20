export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
    if (isRelative && error?.code === 'ERR_MODULE_NOT_FOUND' && !specifier.endsWith('.ts')) {
      return nextResolve(`${specifier}.ts`, context)
    }
    throw error
  }
}

// src/firebaseConfig.ts lê `import.meta.env.VITE_FB_*`, um recurso injetado
// pelo Vite em build/dev. Sob node --test puro esse objeto não existe. Para
// poder testar esse módulo sem alterar src/**, substituímos textualmente
// `import.meta.env` por uma variável global controlável pelos testes.
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context)
  if (url.endsWith('/src/firebaseConfig.ts') && result.source !== undefined) {
    const text = typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString('utf8')
    const source = text.replaceAll('import.meta.env', '(globalThis.__TEST_IMPORT_META_ENV__ ??= {})')
    return { ...result, source }
  }
  return result
}
