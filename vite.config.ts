import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'


// Strips type="module" and crossorigin; moves scripts before </body>.
// Required: PPTB loads tools via iframe srcdoc — no ES module support.
function fixHtmlForPPTB(): Plugin {
  return {
    name: 'fix-html-for-pptb',
    transformIndexHtml(html: string) {
      const scriptTagRegex = /<script([^>]*)>([\s\S]*?)<\/script>/gi
      const scripts: string[] = []
      // Callback always returns '' so every match is removed from html.
      let cleaned = html.replace(scriptTagRegex, (match) => {
        scripts.push(match)
        return ''
      })
      const fixedScripts = scripts.map(s =>
        s.replace(/\s*type="module"/g, '').replace(/\s*crossorigin/g, '')
      )
      cleaned = cleaned.replace('</body>', `${fixedScripts.join('\n')}\n</body>`)
      return cleaned
    }
  }
}

export default defineConfig(({ mode }) => ({
   plugins: [react(), fixHtmlForPPTB()],
   base: './',
   publicDir: 'public',
    build: {
       sourcemap: mode === 'development', // emitted only in development builds
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        manualChunks: undefined,
      }
    }
  }
}));
