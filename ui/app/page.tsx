import Image from "next/image";
import Microphone from "@/components/Microphone";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#ffeaba' }}>
      <Microphone serverUrl="http://localhost:3001" />
    </div>
  );
}
