import Image from "next/image";

export default function HomePhoto() {
  return <figure className="home-photo">
    <Image src="/mecg/members-professional.jpeg" alt="MECG members visiting PwC in Chicago" fill sizes="100vw" preload className="home-photo-soft" />
    <Image src="/mecg/members-professional.jpeg" alt="" aria-hidden fill sizes="100vw" className="home-photo-sharp" />
  </figure>;
}
