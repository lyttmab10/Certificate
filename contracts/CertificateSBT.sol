// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CertificateSBT
 * @dev Soulbound Token (SBT) สำหรับออกใบประกาศนียบัตร
 *      - ไม่สามารถโอนได้ (non-transferable)
 *      - แต่ละ wallet รับได้ 1 ใบต่อ courseId
 *      - เก็บ metadata URI ที่ชี้ไปยัง IPFS (Pinata)
 */
contract CertificateSBT {
    // ============================================================
    //  State Variables
    // ============================================================

    address public owner;
    uint256 private _tokenIdCounter;

    struct Certificate {
        uint256 tokenId;
        address recipient;      // wallet ผู้รับ
        string  studentName;    // ชื่อนักเรียน
        string  courseName;     // ชื่อคอร์ส
        string  courseId;       // รหัสคอร์ส
        string  metadataURI;    // ipfs://Qm... (ชี้ไปยัง JSON metadata บน Pinata)
        uint256 issuedAt;       // timestamp
        bool    revoked;        // ยกเลิกได้โดย owner
    }

    // tokenId => Certificate
    mapping(uint256 => Certificate) private _certificates;

    // wallet => courseId => tokenId (ป้องกันออกซ้ำ)
    mapping(address => mapping(string => uint256)) private _issued;

    // wallet => tokenIds[]
    mapping(address => uint256[]) private _holderTokens;

    // ============================================================
    //  Events
    // ============================================================

    event CertificateIssued(
        uint256 indexed tokenId,
        address indexed recipient,
        string  courseId,
        string  metadataURI,
        uint256 issuedAt
    );

    event CertificateRevoked(uint256 indexed tokenId, address indexed recipient);

    // ============================================================
    //  Modifiers
    // ============================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "SBT: caller is not owner");
        _;
    }

    modifier tokenExists(uint256 tokenId) {
        require(tokenId > 0 && tokenId <= _tokenIdCounter, "SBT: token does not exist");
        _;
    }

    // ============================================================
    //  Constructor
    // ============================================================

    constructor() {
        owner = msg.sender;
    }

    // ============================================================
    //  Issue Certificate
    // ============================================================

    /**
     * @notice ออกใบประกาศนียบัตรให้ผู้เรียน
     * @param recipient   wallet address ของผู้รับ
     * @param studentName ชื่อผู้รับ
     * @param courseName  ชื่อคอร์ส
     * @param courseId    รหัสคอร์ส (ใช้เช็คว่าออกซ้ำหรือไม่)
     * @param metadataURI IPFS URI ของ JSON metadata (จาก Pinata)
     */
    function issueCertificate(
        address recipient,
        string memory studentName,
        string memory courseName,
        string memory courseId,
        string memory metadataURI
    ) external onlyOwner returns (uint256) {
        require(recipient != address(0), "SBT: zero address");
        require(
            _issued[recipient][courseId] == 0,
            "SBT: certificate already issued for this course"
        );

        _tokenIdCounter++;
        uint256 newTokenId = _tokenIdCounter;

        _certificates[newTokenId] = Certificate({
            tokenId:     newTokenId,
            recipient:   recipient,
            studentName: studentName,
            courseName:  courseName,
            courseId:    courseId,
            metadataURI: metadataURI,
            issuedAt:    block.timestamp,
            revoked:     false
        });

        _issued[recipient][courseId] = newTokenId;
        _holderTokens[recipient].push(newTokenId);

        emit CertificateIssued(newTokenId, recipient, courseId, metadataURI, block.timestamp);

        return newTokenId;
    }

    // ============================================================
    //  Revoke Certificate
    // ============================================================

    /**
     * @notice ยกเลิกใบประกาศ (ยังไม่ลบ แต่ flag revoked = true)
     */
    function revokeCertificate(uint256 tokenId)
        external
        onlyOwner
        tokenExists(tokenId)
    {
        Certificate storage cert = _certificates[tokenId];
        require(!cert.revoked, "SBT: already revoked");
        cert.revoked = true;
        emit CertificateRevoked(tokenId, cert.recipient);
    }

    // ============================================================
    //  Read Functions
    // ============================================================

    /// ดึงข้อมูล certificate จาก tokenId
    function getCertificate(uint256 tokenId)
        external
        view
        tokenExists(tokenId)
        returns (Certificate memory)
    {
        return _certificates[tokenId];
    }

    /// ดึง tokenIds ทั้งหมดที่ wallet นี้ถืออยู่
    function getCertificatesByHolder(address holder)
        external
        view
        returns (uint256[] memory)
    {
        return _holderTokens[holder];
    }

    /// เช็คว่า wallet นี้มีใบประกาศของ courseId นี้หรือยัง
    function hasCertificate(address holder, string memory courseId)
        external
        view
        returns (bool)
    {
        return _issued[holder][courseId] != 0;
    }

    /// จำนวน token ทั้งหมดที่ออกไป
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    // ============================================================
    //  SBT: Block All Transfers
    // ============================================================

    /**
     * @dev ฟังก์ชัน transfer ถูก block ทั้งหมด — นี่คือ Soulbound Token
     *      ใครพยายาม transfer จะ revert ทันที
     */
    function transfer(address, uint256) external pure {
        revert("SBT: token is non-transferable");
    }

    function transferFrom(address, address, uint256) external pure {
        revert("SBT: token is non-transferable");
    }

    function approve(address, uint256) external pure {
        revert("SBT: token is non-transferable");
    }
}
