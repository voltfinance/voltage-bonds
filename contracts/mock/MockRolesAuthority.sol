// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.15;

import {Authority} from "solmate/src/auth/Auth.sol";
import {RolesAuthority} from "solmate/src/auth/authorities/RolesAuthority.sol";

contract MockRolesAuthority is RolesAuthority {
    constructor(
        address _owner, 
        Authority _authority
    ) RolesAuthority(_owner, _authority) {}
}
