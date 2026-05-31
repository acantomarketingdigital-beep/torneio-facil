import Image from 'next/image'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { h: 32, maxW: 'max-w-[120px]' },   // header
  md: { h: 48, maxW: 'max-w-[180px]' },   // auth pages
  lg: { h: 64, maxW: 'max-w-[240px]' },   // login hero
}

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const { h, maxW } = sizes[size]
  return (
    <Image
      src="/images/logoprincipal.png"
      alt="TabelaPro"
      width={240}
      height={h}
      className={`w-auto object-contain ${maxW} ${className}`}
      priority
    />
  )
}
