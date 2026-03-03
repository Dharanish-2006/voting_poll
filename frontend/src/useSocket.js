import { useEffect, useRef, useState, useCallback } from "react"
import { io } from "socket.io-client"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001"

export function useSocket() {
  const socketRef = useRef(null)
  const [polls, setPolls] = useState([])
  const [connected, setConnected] = useState(false)
  const [connError, setConnError] = useState(false)
  const [onlineCount, setOnlineCount] = useState(1)

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
    socketRef.current = socket

    socket.on("connect", () => {
      setConnected(true)
      setConnError(false)
    })

    socket.on("disconnect", () => setConnected(false))

    socket.on("connect_error", () => {
      setConnected(false)
      setConnError(true)
    })

    socket.on("polls:update", (updatedPolls) => {
      setPolls(updatedPolls)
      // Simulate online count based on total votes in active poll
      const active = updatedPolls.find((p) => p.active)
      if (active) {
        const total = active.votes.reduce((a, b) => a + b, 0)
        setOnlineCount(Math.max(1, total + Math.floor(Math.random() * 5) + 3))
      }
    })

    return () => socket.disconnect()
  }, [])

  const createPoll = useCallback((data) => {
    socketRef.current?.emit("poll:create", data)
  }, [])

  const activatePoll = useCallback((pollId) => {
    socketRef.current?.emit("poll:activate", { pollId })
  }, [])

  const closePoll = useCallback((pollId) => {
    socketRef.current?.emit("poll:close", { pollId })
  }, [])

  const deletePoll = useCallback((pollId) => {
    socketRef.current?.emit("poll:delete", { pollId })
  }, [])

  const castVote = useCallback((pollId, optionIndex, voterId) => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current
      if (!socket) return reject(new Error("Not connected"))

      const onSuccess = (data) => {
        if (data.pollId === pollId) {
          socket.off("vote:success", onSuccess)
          socket.off("vote:error", onError)
          resolve(data)
        }
      }
      const onError = (err) => {
        socket.off("vote:success", onSuccess)
        socket.off("vote:error", onError)
        reject(new Error(err.message))
      }

      socket.on("vote:success", onSuccess)
      socket.on("vote:error", onError)
      socket.emit("vote:cast", { pollId, optionIndex, voterId })
    })
  }, [])

  const exportCSV = useCallback((pollId) => {
    window.open(`${BACKEND_URL}/api/polls/${pollId}/export`, "_blank")
  }, [])

  return {
    polls,
    connected,
    connError,
    onlineCount,
    createPoll,
    activatePoll,
    closePoll,
    deletePoll,
    castVote,
    exportCSV,
  }
}
