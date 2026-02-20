import EpubToZipConverter from './EpubToZipConverter'

export default function EpubtoZip() {
  return (
    <div className="z-10  w-[60%]  m-auto h-[60vh] items-center justify-between  text-sm">
      <h1 className="text-2xl  mb-8 text-center">EPub to ZIP Converter</h1>
      <EpubToZipConverter />
    </div>
  )
}
