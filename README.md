# THELLEX POS PROTOCOL

sncast account import \
 --address=0x04554cf79c1e8b54a5283a279eb08f29574ec287ff762c2641356fc971094288 \
 --type=oz \
 --url=http://127.0.0.1:5050 \
 --private-key=0x00000000000000000000000000000000471ce2ce0a963bfd8dcd95b9b49fc09f \
 --add-profile=devnet \
 --silent

| Account address | 0x04554cf79c1e8b54a5283a279eb08f29574ec287ff762c2641356fc971094288
| Private key | 0x00000000000000000000000000000000471ce2ce0a963bfd8dcd95b9b49fc09f
| Public key | 0x00992f152edede5f3d781c56fbace66c7fa4b76080cb96fdd00ae4e783cfd510

sncast --profile=devnet declare \
 --contract-name=ThellexPOSFactory
