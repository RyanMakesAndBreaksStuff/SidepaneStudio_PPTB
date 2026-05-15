import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// Strips type="module" and crossorigin; moves scripts before </body>.
// Required: PPTB loads tools via iframe srcdoc — no ES module support.
function fixHtmlForPPTB(): Plugin {
  return {
    name: 'fix-html-for-pptb',
    transformIndexHtml(html: string) {
      const scriptTagRegex = /<script([^>]*)>([\s\S]*?)<\/script>/gi
      const scripts: string[] = []
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

export default defineConfig({
  plugins: [react(), fixHtmlForPPTB()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        manualChunks: undefined,
      }
    }
  }
})
