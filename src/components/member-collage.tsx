import Image from "next/image";

const MECG_PHOTOS = [
  { src: "/mecg/members-in-chicago.jpg", alt: "MECG members together in Chicago" },
  { src: "/mecg/members-outdoors.jpg", alt: "MECG members at an outdoor Michigan event" },
  { src: "/mecg/members-together.jpg", alt: "MECG members spending time together" },
  { src: "/mecg/members-formal.jpg", alt: "MECG members at a formal event" },
];

export function MemberCollage() {
  return (
    <div className="grid min-h-[23rem] grid-cols-2 grid-rows-2 gap-3 sm:min-h-[28rem]">
      {MECG_PHOTOS.slice(0, 3).map((photo, index) => (
        <div
          key={photo.src}
          className={`relative overflow-hidden bg-mecg-blue/10 outline outline-1 -outline-offset-1 outline-black/10 ${
            index === 0
              ? "row-span-2 rounded-[2rem]"
              : "rounded-2xl"
          }`}
        >
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            className="object-cover object-center"
            sizes="(min-width: 1024px) 25vw, 50vw"
          />
        </div>
      ))}
    </div>
  );
}

export function MemberFaces() {
  return (
    <div className="flex items-center">
      {MECG_PHOTOS.map((photo, index) => (
        <div
          key={photo.src}
          className={`relative h-11 w-11 overflow-hidden rounded-full bg-white outline outline-2 outline-white ${
            index === 0 ? "" : "-ml-2.5"
          }`}
        >
          <Image
            src={photo.src}
            alt=""
            fill
            className="object-cover object-center"
            sizes="44px"
          />
        </div>
      ))}
    </div>
  );
}
