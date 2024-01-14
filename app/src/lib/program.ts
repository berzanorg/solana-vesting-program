export type SolanaVestingProgram = {
	version: "0.1.0"
	name: "solana_vesting_program"
	instructions: [
		{
			name: "lock"
			accounts: [
				{
					name: "vault"
					isMut: true
					isSigner: false
				},
				{
					name: "vaultAta"
					isMut: true
					isSigner: false
				},
				{
					name: "locking"
					isMut: true
					isSigner: false
				},
				{
					name: "signerAta"
					isMut: true
					isSigner: false
				},
				{
					name: "signer"
					isMut: true
					isSigner: true
				},
				{
					name: "mint"
					isMut: false
					isSigner: false
				},
				{
					name: "tokenProgram"
					isMut: false
					isSigner: false
				},
				{
					name: "associatedTokenProgram"
					isMut: false
					isSigner: false
				},
				{
					name: "systemProgram"
					isMut: false
					isSigner: false
				}
			]
			args: [
				{
					name: "receiver"
					type: "publicKey"
				},
				{
					name: "amount"
					type: "u64"
				},
				{
					name: "startDate"
					type: "u64"
				},
				{
					name: "endDate"
					type: "u64"
				}
			]
		},
		{
			name: "unlock"
			accounts: [
				{
					name: "vault"
					isMut: true
					isSigner: false
				},
				{
					name: "vaultAta"
					isMut: true
					isSigner: false
				},
				{
					name: "receiverAta"
					isMut: true
					isSigner: false
				},
				{
					name: "receiver"
					isMut: false
					isSigner: false
				},
				{
					name: "locking"
					isMut: true
					isSigner: false
				},
				{
					name: "signer"
					isMut: true
					isSigner: true
				},
				{
					name: "mint"
					isMut: false
					isSigner: false
				},
				{
					name: "tokenProgram"
					isMut: false
					isSigner: false
				},
				{
					name: "associatedTokenProgram"
					isMut: false
					isSigner: false
				},
				{
					name: "systemProgram"
					isMut: false
					isSigner: false
				}
			]
			args: []
		}
	]
	accounts: [
		{
			name: "vault"
			type: {
				kind: "struct"
				fields: []
			}
		},
		{
			name: "locking"
			type: {
				kind: "struct"
				fields: [
					{
						name: "mint"
						type: "publicKey"
					},
					{
						name: "receiver"
						type: "publicKey"
					},
					{
						name: "amount"
						type: "u64"
					},
					{
						name: "amountUnlocked"
						type: "u64"
					},
					{
						name: "startDate"
						type: "u64"
					},
					{
						name: "endDate"
						type: "u64"
					}
				]
			}
		}
	]
	errors: [
		{
			code: 6000
			name: "EndBeforeStart"
		},
		{
			code: 6001
			name: "CliffPeriodNotPassed"
		}
	]
}
