import { LightningElement, api } from 'lwc';
import { publish, subscribe, MessageContext } from 'lightning/messageService';
import CART_CHANGED from '@salesforce/messageChannel/lightning__commerce_cartChanged';

import getMyPartList from '@salesforce/apex/LSTA_PartsOrderMyPartListController.getMyPartList';

export default class Lsta_PartOrderMyPartList extends LightningElement {

    columns = [
        { label: 'Sales Status', fieldName: 'salesStatus', initialWidth: 140 },
        { label: 'Part No', fieldName: 'partNo', initialWidth: 120 },
        { label: 'Old Part Number', fieldName: 'oldPartNumber', initialWidth: 150 },
        { label: 'Part Name', fieldName: 'partName', initialWidth: 200 },
        { label: 'Qty', fieldName: 'qty', type: 'number', initialWidth: 105 },
        { label: 'Unit Price', fieldName: 'unitPrice', initialWidth: 135 },
        { label: 'Billed Amount', fieldName: 'billedAmount', type: 'currency', initialWidth: 150 },
        { label: 'Latest Order Date', fieldName: 'latestOrderDate', type: 'date', initialWidth: 160 },
        { label: 'Latest Order Quantity', fieldName: 'latestOrderQuantity', type: 'number', initialWidth: 185 },
        { label: 'Initial Wishlist Registration Date', fieldName: 'registrationDate', type: 'date', initialWidth: 250 },
        { label: 'Model Name', fieldName: 'modelName', initialWidth: 300 },
        { label: 'Notes', fieldName: 'notes', initialWidth: 110 },
        { label: 'Remark', fieldName: 'remark', initialWidth: 130 }
    ];

    showCreateListModal;
    showEditListModal;
    showAddPartModal;
    showAddToWishlistModal;
    showUploadSection;
    displayNoData;

    partsList = [];
    targetList = [];
    myPartsListColumns = [];
    partsToAddToMyPartsListColumns = [];

    // 서버에서 listWishlist 를 list로 주기 때문
    wishlistIndexById = {};
    // 전체 데이터
    myPartsList = [];
    // 전체 데이터 중 찜목록 하나
    myPartsListItem = {};
    // Datatable 출력용
    wishlistItemsDataTableRows = [];

    isDone = true;
    isDoneSearch = false;
    isNewPartList = false;
    isEditMyPartListName = false;
    isAddPartsInPartList = false;

    myPartsListId = '';

    selectedBuffer = [];
    selectedBufferTarget = [];
    selectedBufferByAdd = [];

    isUploadMyPartListFile = false;
    isCloneMyParts = false;

    partsCloneTableColums = []; // (원문 표기 유지)
    isTypeClone = true;

    draftValues = [];
    draftValueMap = {}; // 필요 시 new Map() 으로 교체 가능

    isShowCompSet = false;
    checkPartNumber = {};
    checkQuantity = 0;

    selectedLeftModalBuffer = [];
    partsToCart = [];

    isDistributor = false;
    isSelectObjCode = false;

    orderTypeOptions = [
        { label: '일반주문', value: 'Default Delivery' },
        { label: '정기주문', value: 'StandingOrder Delivery' },
        { label: '직송주문', value: 'DirectOrder Delivery' },
        { label: '직납주문', value: 'DirectPaymentOrder Delivery' }
    ];

    selectedOrderType = 'Default Delivery';

    sitePrefix = '';

    selectedOrderRowKeys = []; // selected rows (by key-field)

    async connectedCallback() {
        await this.queryMyPartList();
    }

    async queryMyPartList() {
        try {
            const { result, payload } = await getMyPartList();
            if (result !== 'OK') {
                displayNoData = true;
                this.myPartsList = [];
                this.myPartsListItem = {};
                return;
            }
            console.log(payload);

            this.displayNoData = false;
            this.myPartsList = Array.isArray(payload.listWishlist) ? payload.listWishlist : [];
            this.pricebookEntryMap = payload.mapPricebookEntry ?? {};

            if (this.myPartsList.length > 0) {

                this.myPartsList.forEach((wishlist, index) => {
                    if (wishlist?.Id) {
                        this.wishlistIndexById[wishlist.Id] = index;
                    }
                });

                this.selectListByIndex(0);

            } else {
                this.myPartsListItem = {};
            }
        } catch (error) {
            console.error(error);
            this.displayNoData = true;
            this.myPartsList = [];
            this.myPartsListItem = {};
        }
    }

    formatWishlistItemForDataTable(wishlistItem) {
        if (!wishlistItem) {
            return null;
        }

        const unitPrice = this.pricebookEntryMap?.[wishlistItem.Product2Id]?.UnitPrice ?? 0;
        const vatIncludedUnitPrice = Math.round(unitPrice * 1.1);

        return {
            id: wishlistItem.Id,
            salesStatus: wishlistItem.Product2?.Part__r?.isSalesPart__c ? '' : '판매중지',
            partNo: wishlistItem.Product2?.Part__r?.Partnum__c,
            oldPartNumber: wishlistItem.Product2?.Part__r?.OldPartnum__c,
            partName: wishlistItem.Product2?.Part__r?.NameKor__c,
            quantity: wishlistItem.Quantity__c,
            unitPrice: unitPrice,
            billedAmount: this.isDistributor
                ? wishlistItem.Quantity__c * unitPrice
                : wishlistItem.Quantity__c * vatIncludedUnitPrice,
            latestOrderDate: wishlistItem.LastOrderedDate__c
                ? this.toFormatDate(wishlistItem.LastOrderedDate__c)
                : null,
            latestOrderQuantity: wishlistItem.LastQuantity__c ?? 0,
            registrationDate: this.toFormatDate(wishlistItem.CreatedDate),
            modelName: wishlistItem.Product2?.fm_Model_Names__c,
            notes: wishlistItem.Product2?.REF__c,
            remark: wishlistItem.Remark__c
        };
    }
    
    formatWishlistItemsForDataTable() {
        return (this.myPartsListItem.WishlistItems ?? []).map((wishlistItem) =>
            this.formatWishlistItemForDataTable(wishlistItem)
        );
    }

    toFormatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
    }

    handleListSelect(event) {
        const wishlistId = event.detail.value;
        this.selectListByIndex(this.wishlistIndexById[wishlistId]);
    }

    selectListByIndex(wishlistIndex) {
        this.myPartsListItem = this.myPartsList[wishlistIndex];
        this.wishlistItemsDataTableRows = this.formatWishlistItemsForDataTable();
    }

    handleMenuSelect(event) {
        const selected = event.detail.value;

        switch (selected) {
            case 'create':
                console.log('create' + selected);
                this.showCreateListModal = true;
                break;
            case 'clear':
                console.log('clear' + selected);
                this.handleClickClearList();
                break;
            case 'delete':
                console.log('delete' + selected);
                this.handleClickDeleteList();
                break;
            case 'edit':
                console.log('edit' + selected);
                this.showEditListModal = true;
                break;
            default:
        }
    }






    async handleClickAddPart(event) {
            console.log('async handleClickAddPart');
        try {
            this.isLoading = true;
            // 파트 추가 로직
        } finally {
            this.isLoading = false;
        }
    }

    async handleClickDeletePart(event) {
            console.log('async handleClickDeletePart');
        try {
            this.isLoading = true;
            // 선택 행 검증 → 확인 모달 → 삭제 로직
        } finally {
            this.isLoading = false;
        }
    }

    handleClickUploadCsv(event) {
            console.log('handleClickUploadCsv(event');
        // 실제 업로드는 lightning-file-upload를 사용 권장
        // 여기서는 업로드 섹션 열기/모달 오픈 트리거
    }

    handleClickDownloadCsvForm(event) {
            console.log('handleClickDownloadCsvForm(event');
        // 서버에서 템플릿 생성/다운로드 트리거
    }

    async handleClickAddToWishlist(event) {
            console.log('async handleClickAddToWishlist');
        try {
            this.isLoading = true;
            // 위시리스트 추가 로직
        } finally {
            this.isLoading = false;
        }
    }

    handleClickPrint(event) {
            console.log('handleClickPrint(event');
        // 인쇄 전용 레이아웃 팝업 또는 window.print()
    }

    async handleClickAddToCart(event) {
            console.log('async handleClickAddToCart');
        try {
            this.isLoading = true;
            // 장바구니 추가 로직
        } finally {
            this.isLoading = false;
        }
    }


    handleOrderRowSelection(event) {};
}