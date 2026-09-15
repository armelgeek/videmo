"use client"

import { useState } from "react"
import { generateRecoveryCodes } from "@/actions/auth/manage-recovery-codes"
import { toast } from "sonner"
import { Copy, Check } from "lucide-react"

export function RecoveryCodesForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [codes, setCodes] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setIsLoading(true)
    const result = await generateRecoveryCodes()

    if (result.error) {
      toast.error(result.error)
    } else if (result.codes) {
      setCodes(result.codes)
      toast.success("Recovery codes generated!")
    }
    setIsLoading(false)
  }

  function handleCopyAll() {
    const text = codes.join("\n")
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Copied to clipboard!")
    setTimeout(() => setCopied(false), 2000)
  }

  if (codes.length > 0) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-yellow-50 border-2 border-sk-hi rounded">
          <p className="text-xs font-semibold mb-3">Save these codes in a safe place:</p>
          <div className="space-y-2 font-mono text-sm">
            {codes.map((code, i) => (
              <div key={i} className="text-gray-700">{code}</div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyAll}
          className="sk-btn flex items-center gap-2 w-full justify-center"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied!" : "Copy All"}
        </button>

        <button
          type="button"
          onClick={() => setCodes([])}
          className="sk-btn w-full"
          disabled={isLoading}
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={isLoading}
      className="sk-btn sk-btn-main"
    >
      {isLoading ? "Generating…" : "Generate Recovery Codes →"}
    </button>
  )
}
