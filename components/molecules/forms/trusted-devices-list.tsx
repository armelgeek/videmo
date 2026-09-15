"use client"

import { useEffect, useState } from "react"
import { getTrustedDevices, revokeTrustedDevice } from "@/actions/auth/manage-trusted-devices"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

export function TrustedDevicesList() {
  const [isLoading, setIsLoading] = useState(true)
  const [devices, setDevices] = useState<any[]>([])
  const [revoking, setRevoking] = useState<string | null>(null)

  useEffect(() => {
    loadDevices()
  }, [])

  async function loadDevices() {
    setIsLoading(true)
    const result = await getTrustedDevices()
    if (result.success) {
      setDevices(result.devices || [])
    }
    setIsLoading(false)
  }

  async function handleRevoke(deviceId: string) {
    setRevoking(deviceId)
    const result = await revokeTrustedDevice(deviceId)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Device revoked")
      setDevices(devices.filter(d => d.id !== deviceId))
    }
    setRevoking(null)
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading devices…</p>
  }

  if (devices.length === 0) {
    return <p className="text-sm text-muted-foreground">No trusted devices yet.</p>
  }

  return (
    <div className="space-y-3">
      {devices.map(device => (
        <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex-1">
            <p className="text-sm font-medium">{device.deviceHash?.slice(0, 12)}…</p>
            <p className="text-xs text-muted-foreground">
              Last used: {new Date(device.lastUsedAt).toLocaleDateString()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleRevoke(device.id)}
            disabled={revoking === device.id}
            className="text-destructive hover:opacity-70 p-2"
            aria-label="Revoke device"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
